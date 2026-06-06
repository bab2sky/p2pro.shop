use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        Query, State, WebSocketUpgrade,
    },
    response::Response,
    Extension,
};
use futures::{SinkExt, StreamExt};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::Deserialize;
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

use crate::domain::chat::{WsClientMessage, WsServerMessage};
use crate::middleware::auth::{AuthUser, Claims, JWT_AUDIENCE, JWT_ISSUER};
use crate::AppState;

pub type RoomConnections = Arc<RwLock<HashMap<Uuid, HashMap<Uuid, mpsc::UnboundedSender<String>>>>>;

pub type UserConnections = Arc<RwLock<HashMap<Uuid, Vec<(Uuid, mpsc::UnboundedSender<String>)>>>>;

#[derive(Clone)]
pub struct WsHub {
    rooms: RoomConnections,
    users: UserConnections,
}

impl Default for WsHub {
    fn default() -> Self {
        Self::new()
    }
}

impl WsHub {
    pub fn new() -> Self {
        Self {
            rooms: Arc::new(RwLock::new(HashMap::new())),
            users: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // ─── Room methods (chat) ───

    pub async fn join(&self, room_id: Uuid, user_id: Uuid, tx: mpsc::UnboundedSender<String>) {
        let mut rooms = self.rooms.write().await;
        rooms.entry(room_id).or_default().insert(user_id, tx);
    }

    pub async fn leave(&self, room_id: Uuid, user_id: Uuid) {
        let mut rooms = self.rooms.write().await;
        if let Some(room) = rooms.get_mut(&room_id) {
            room.remove(&user_id);
            if room.is_empty() {
                rooms.remove(&room_id);
            }
        }
    }

    pub async fn send_to_room(&self, room_id: Uuid, exclude_user: Uuid, message: &str) {
        let rooms = self.rooms.read().await;
        if let Some(room) = rooms.get(&room_id) {
            for (uid, tx) in room.iter() {
                if *uid != exclude_user {
                    let _ = tx.send(message.to_string());
                }
            }
        }
    }

    pub async fn is_user_online(&self, room_id: Uuid, user_id: Uuid) -> bool {
        let rooms = self.rooms.read().await;
        rooms
            .get(&room_id)
            .map(|r| r.contains_key(&user_id))
            .unwrap_or(false)
    }

    // ─── User notification methods ───

    /// Connect user for notifications (supports multiple tabs/devices)
    /// FR-31: 사용자당 최대 10개 연결 제한
    pub async fn connect_user(&self, user_id: Uuid, tx: mpsc::UnboundedSender<String>) -> Uuid {
        let conn_id = Uuid::new_v4();
        let mut users = self.users.write().await;
        let conns = users.entry(user_id).or_default();
        // FR-31: 최대 10개 초과 시 가장 오래된 연결 제거
        while conns.len() >= 10 {
            if let Some((old_id, _)) = conns.first() {
                let old_id = *old_id;
                conns.retain(|(cid, _)| *cid != old_id);
                tracing::debug!(
                    "User {} evicted old connection {} (limit 10)",
                    user_id,
                    old_id
                );
            }
        }
        conns.push((conn_id, tx));
        tracing::debug!(
            "User {} connected for notifications (conn={}, total={})",
            user_id,
            conn_id,
            conns.len()
        );
        conn_id
    }

    /// Disconnect user notification channel
    pub async fn disconnect_user(&self, user_id: Uuid, conn_id: Uuid) {
        let mut users = self.users.write().await;
        if let Some(conns) = users.get_mut(&user_id) {
            conns.retain(|(cid, _)| *cid != conn_id);
            if conns.is_empty() {
                users.remove(&user_id);
            }
        }
    }

    /// Send notification to all connected devices/tabs of a user
    pub async fn notify_user(&self, user_id: Uuid, message: &str) {
        let users = self.users.read().await;
        if let Some(conns) = users.get(&user_id) {
            for (_, tx) in conns.iter() {
                let _ = tx.send(message.to_string());
            }
        }
    }

    /// Check if user has any active notification connections
    pub async fn is_user_connected(&self, user_id: Uuid) -> bool {
        let users = self.users.read().await;
        users.get(&user_id).map(|c| !c.is_empty()).unwrap_or(false)
    }
}

// ─── Chat WebSocket ───
// FR-24: query string에서 token 제거, post-connect auth 방식으로 변경

#[derive(Debug, Deserialize)]
pub struct WsQueryParams {
    room_id: Uuid,
}

/// FR-24: Chat WS auth message (첫 메시지로 전송)
#[derive(Debug, Deserialize)]
struct WsChatAuthMessage {
    #[serde(rename = "type")]
    msg_type: String,
    token: String,
}

pub async fn handle_ws_upgrade(
    State(state): State<AppState>,
    Extension(hub): Extension<WsHub>,
    Query(params): Query<WsQueryParams>,
    ws: WebSocketUpgrade,
) -> Result<Response, crate::AppError> {
    let room_id = params.room_id;

    // FR-24: 연결 수락 후 첫 메시지로 인증 처리 (token을 URL에 노출하지 않음)
    Ok(ws.on_upgrade(move |socket| handle_ws_auth_then_connect(socket, state, hub, room_id)))
}

/// FR-24: 연결 후 10초 내 auth 메시지 수신 → 인증 → 채팅 핸들러로 전환
async fn handle_ws_auth_then_connect(
    mut socket: WebSocket,
    state: AppState,
    hub: WsHub,
    room_id: Uuid,
) {
    // Wait for auth message as first message (timeout 10s)
    let auth_result = tokio::time::timeout(std::time::Duration::from_secs(10), async {
        while let Some(Ok(msg)) = socket.recv().await {
            if let Message::Text(text) = msg {
                let text_str: &str = &text;
                if let Ok(auth_msg) = serde_json::from_str::<WsChatAuthMessage>(text_str) {
                    if auth_msg.msg_type == "auth" {
                        return Some(auth_msg.token);
                    }
                }
            }
        }
        None
    })
    .await;

    let token = match auth_result {
        Ok(Some(t)) => t,
        _ => {
            tracing::warn!(
                "Chat WS: auth timeout or no auth message received for room {}",
                room_id
            );
            let _ = socket
                .send(Message::Text(
                    r#"{"type":"error","message":"Authentication required"}"#.into(),
                ))
                .await;
            return;
        }
    };

    // Validate JWT
    let mut validation = Validation::default();
    validation.set_issuer(&[JWT_ISSUER]);
    validation.set_audience(&[JWT_AUDIENCE]);

    let token_data = match decode::<Claims>(
        &token,
        &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        &validation,
    ) {
        Ok(data) => data,
        Err(e) => {
            tracing::warn!("Chat WS: invalid token for room {}: {}", room_id, e);
            let _ = socket
                .send(Message::Text(
                    r#"{"type":"error","message":"Invalid token"}"#.into(),
                ))
                .await;
            return;
        }
    };

    let auth_user = AuthUser {
        id: token_data.claims.sub,
        role: crate::domain::user::UserRole::from_str_lossy(&token_data.claims.role),
        is_udg_member: token_data.claims.is_udg_member,
    };

    // Check room participation
    let is_participant = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM chat_rooms WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2))",
    )
    .bind(room_id)
    .bind(auth_user.id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(false);

    if !is_participant {
        let _ = socket
            .send(Message::Text(
                r#"{"type":"error","message":"Not a participant of this chat room"}"#.into(),
            ))
            .await;
        return;
    }

    // Send auth success
    let _ = socket
        .send(Message::Text(r#"{"type":"auth_success"}"#.into()))
        .await;

    // Continue with normal chat handling
    handle_ws_connection(socket, state, hub, room_id, auth_user).await;
}

async fn handle_ws_connection(
    socket: WebSocket,
    state: AppState,
    hub: WsHub,
    room_id: Uuid,
    auth_user: AuthUser,
) {
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    hub.join(room_id, auth_user.id, tx).await;

    let write_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    let hub_clone = hub.clone();
    let user_id = auth_user.id;
    let db = state.db.clone();

    while let Some(Ok(msg)) = ws_receiver.next().await {
        match msg {
            Message::Text(text) => {
                let text_str: &str = &text;
                match serde_json::from_str::<WsClientMessage>(text_str) {
                    Ok(client_msg) => {
                        handle_client_message(&hub_clone, &db, room_id, user_id, client_msg).await;
                    }
                    Err(e) => {
                        tracing::warn!("WS parse error from user {}: {}", user_id, e);
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    hub.leave(room_id, user_id).await;
    write_task.abort();

    tracing::debug!("WS disconnected: user {} from room {}", user_id, room_id);
}

async fn handle_client_message(
    hub: &WsHub,
    db: &sqlx::PgPool,
    room_id: Uuid,
    sender_id: Uuid,
    msg: WsClientMessage,
) {
    match msg {
        WsClientMessage::Message { content } => {
            if content.trim().is_empty() {
                return;
            }

            // A-H7: Safe UTF-8 truncation (prevents panic on multi-byte chars)
            let content = if content.chars().count() > 2000 {
                content.chars().take(2000).collect::<String>()
            } else {
                content
            };

            let content = content
                .replace('&', "&amp;")
                .replace('<', "&lt;")
                .replace('>', "&gt;")
                .replace('"', "&quot;")
                .replace('\'', "&#x27;");

            let msg_id = Uuid::new_v4();
            let now = chrono::Utc::now();

            let insert_result = sqlx::query(
                r#"WITH msg AS (
                    INSERT INTO chat_messages (id, room_id, sender_id, content, is_read, created_at)
                    VALUES ($1, $2, $3, $4, false, $5)
                    RETURNING id
                )
                UPDATE chat_rooms SET last_message_at = $5
                WHERE id = $2 AND EXISTS (SELECT 1 FROM msg)"#,
            )
            .bind(msg_id)
            .bind(room_id)
            .bind(sender_id)
            .bind(&content)
            .bind(now)
            .execute(db)
            .await;

            if let Err(e) = insert_result {
                tracing::error!("Failed to insert chat message: {}", e);
                return;
            }

            let server_msg = WsServerMessage::Message {
                id: msg_id,
                sender_id,
                content,
                created_at: now,
            };

            if let Ok(json) = serde_json::to_string(&server_msg) {
                hub.send_to_room(room_id, Uuid::nil(), &json).await;
            }
        }
        WsClientMessage::Typing => {
            let server_msg = WsServerMessage::Typing { sender_id };
            if let Ok(json) = serde_json::to_string(&server_msg) {
                hub.send_to_room(room_id, sender_id, &json).await;
            }
        }
        WsClientMessage::Read => {
            let _ = sqlx::query(
                "UPDATE chat_messages SET is_read = true WHERE room_id = $1 AND sender_id != $2 AND is_read = false",
            )
            .bind(room_id)
            .bind(sender_id)
            .execute(db)
            .await;

            let server_msg = WsServerMessage::ReadConfirm {
                reader_id: sender_id,
            };
            if let Ok(json) = serde_json::to_string(&server_msg) {
                hub.send_to_room(room_id, sender_id, &json).await;
            }
        }
    }
}

// ─── Notification WebSocket ───

// CRIT-08: Auth message sent after connection (not in URL query)
#[derive(Debug, Deserialize)]
struct WsAuthMessage {
    #[serde(rename = "type")]
    msg_type: String,
    token: String,
}

/// GET /ws/notifications (no token in URL — auth via first message)
pub async fn handle_notify_ws_upgrade(
    State(state): State<AppState>,
    Extension(hub): Extension<WsHub>,
    ws: WebSocketUpgrade,
) -> Result<Response, crate::AppError> {
    Ok(ws.on_upgrade(move |socket| handle_notify_connection(socket, state, hub)))
}

async fn handle_notify_connection(socket: WebSocket, state: AppState, hub: WsHub) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Wait for auth message as first message (timeout 10s)
    let auth_result = tokio::time::timeout(std::time::Duration::from_secs(10), async {
        while let Some(Ok(msg)) = ws_receiver.next().await {
            if let Message::Text(text) = msg {
                let text_str: &str = &text;
                if let Ok(auth_msg) = serde_json::from_str::<WsAuthMessage>(text_str) {
                    if auth_msg.msg_type == "auth" {
                        return Some(auth_msg.token);
                    }
                }
            }
        }
        None
    })
    .await;

    let token = match auth_result {
        Ok(Some(t)) => t,
        _ => {
            tracing::warn!("Notify WS: auth timeout or no auth message received");
            let _ = ws_sender
                .send(Message::Text(
                    r#"{"type":"error","message":"Authentication required"}"#.into(),
                ))
                .await;
            return;
        }
    };

    // Validate JWT
    let mut validation = Validation::default();
    validation.set_issuer(&[JWT_ISSUER]);
    validation.set_audience(&[JWT_AUDIENCE]);

    let user_id = match decode::<Claims>(
        &token,
        &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        &validation,
    ) {
        Ok(data) => data.claims.sub,
        Err(e) => {
            tracing::warn!("Notify WS: invalid token: {}", e);
            let _ = ws_sender
                .send(Message::Text(
                    r#"{"type":"error","message":"Invalid token"}"#.into(),
                ))
                .await;
            return;
        }
    };

    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
    let conn_id = hub.connect_user(user_id, tx).await;

    // Send auth success confirmation
    let _ = ws_sender
        .send(Message::Text(r#"{"type":"auth_success"}"#.into()))
        .await;

    let write_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(msg)) = ws_receiver.next().await {
        if let Message::Close(_) = msg {
            break;
        }
    }

    hub.disconnect_user(user_id, conn_id).await;
    write_task.abort();
    tracing::debug!("Notify WS disconnected: user {}", user_id);
}
