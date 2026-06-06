use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::ws::WsHub;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Notification {
    pub id: Uuid,
    pub user_id: Uuid,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub ntype: String,
    pub title: String,
    pub content: String,
    pub link: Option<String>,
    pub is_read: bool,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct NotificationListResponse {
    pub data: Vec<Notification>,
    pub pagination: super::common::Pagination,
}

#[derive(Debug, Serialize)]
pub struct UnreadCountResponse {
    pub data: UnreadCount,
}

#[derive(Debug, Serialize)]
pub struct UnreadCount {
    pub count: i64,
}

/// Helper to insert a notification + push via WebSocket if user is online
pub async fn create_notification(
    db: &sqlx::PgPool,
    hub: Option<&WsHub>,
    user_id: Uuid,
    ntype: &str,
    title: &str,
    message: &str,
    link: Option<&str>,
) -> Result<(), sqlx::Error> {
    let id = Uuid::new_v4();
    let now = chrono::Utc::now();

    sqlx::query(
        r#"INSERT INTO notifications (id, user_id, type, title, content, link, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
    )
    .bind(id)
    .bind(user_id)
    .bind(ntype)
    .bind(title)
    .bind(message)
    .bind(link)
    .bind(now)
    .execute(db)
    .await?;

    // WebSocket push (real-time delivery if user is online)
    if let Some(hub) = hub {
        let ws_msg = serde_json::json!({
            "type": "notification",
            "data": {
                "id": id,
                "type": ntype,
                "title": title,
                "content": message,
                "link": link,
                "is_read": false,
                "created_at": now,
            }
        });
        if let Ok(json) = serde_json::to_string(&ws_msg) {
            hub.notify_user(user_id, &json).await;
        }
    }

    Ok(())
}
