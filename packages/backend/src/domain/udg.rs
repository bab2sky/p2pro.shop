use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

/// UDG webhook payload for order.confirmed event (FR-02)
/// v1.2.0: udgworld가 요구하는 base_price/commission_rate/commission_amount 필드 추가.
/// margin_* 필드는 호환성/기록용으로 유지.
#[derive(Debug, Serialize)]
pub struct UdgOrderConfirmedPayload {
    pub order_id: Uuid,
    pub order_number: String,
    pub buyer_id: Uuid,
    pub seller_id: Uuid,
    pub total_amount: String,
    pub base_price: String,
    pub commission_rate: String,
    pub commission_amount: String,
    pub margin_amount: String,
    pub margin_rate: String,
    pub confirmed_at: String,
}

/// UDG webhook payload for order.udg_cancelled event (FR-05)
#[derive(Debug, Serialize)]
pub struct UdgOrderCancelledPayload {
    pub order_id: Uuid,
    pub order_number: String,
    pub reason: String,
    pub cancelled_at: String,
}

/// FR-01, FR-02, FR-03: 주문 confirmed 시 UDG webhook 이벤트 enqueue
/// is_udg_member인 구매자의 주문만 발송
pub async fn enqueue_udg_order_confirmed(
    db: &PgPool,
    order_id: Uuid,
) -> anyhow::Result<Option<Uuid>> {
    // v1.2.0: udgworld가 요구하는 base_price / commission_rate / commission_amount 추가.
    // base_price는 (subtotal - margin_amount) 로 계산 — 셀러가 입력한 base * quantity 합계와 동치.
    //
    // margin_rate 는 order_items 별로 다를 수 있어 단일값이 의미 없고, udg 쪽에서도
    // 실제로는 사용하지 않음 (분배는 commission_amount 기반). 기록/호환성용 0 으로 고정.
    // 이전엔 sp.margin_rate 를 참조했으나 seller_profiles 에 그 컬럼이 없어
    // SQL 에러로 enqueue 함수가 영구 실패해왔음 (이게 즉시 분배 안 되던 진짜 원인).
    let row = sqlx::query_as::<
        _,
        (
            String,
            Uuid,
            Uuid,
            String,
            String,
            String,
            String,
            String,
            String,
            bool,
        ),
    >(
        r#"SELECT o.order_number, o.buyer_id, o.seller_id,
                  o.total_amount::TEXT,
                  GREATEST(o.subtotal - o.margin_amount, 0)::TEXT AS base_price,
                  COALESCE(o.commission_rate::TEXT, '0'),
                  COALESCE(o.commission_amount::TEXT, '0'),
                  o.margin_amount::TEXT,
                  COALESCE(o.confirmed_at::TEXT, NOW()::TEXT),
                  u.is_udg_member
           FROM orders o
           JOIN users u ON u.id = o.buyer_id
           WHERE o.id = $1 AND o.status = 'confirmed'"#,
    )
    .bind(order_id)
    .fetch_optional(db)
    .await?;

    let Some((
        order_number,
        buyer_id,
        seller_id,
        total,
        base_price,
        commission_rate,
        commission_amount,
        margin,
        confirmed,
        is_udg,
    )) = row
    else {
        return Ok(None);
    };

    // FR-03: UDG 회원만
    if !is_udg {
        return Ok(None);
    }

    let payload = UdgOrderConfirmedPayload {
        order_id,
        order_number,
        buyer_id,
        seller_id,
        total_amount: total,
        base_price,
        commission_rate,
        commission_amount,
        margin_amount: margin,
        // udg 쪽 미사용 필드 — 호환성 위해 "0" 으로 고정.
        margin_rate: "0".to_string(),
        confirmed_at: confirmed,
    };

    let payload_json = serde_json::to_value(&payload)?;

    let event_id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO webhook_events (id, event_type, payload, status, attempts, order_id)
           VALUES ($1, 'order.confirmed', $2, 'pending', 0, $3)"#,
    )
    .bind(event_id)
    .bind(&payload_json)
    .bind(order_id)
    .execute(db)
    .await?;

    // FR-09: udg_event_sent_at 기록
    sqlx::query("UPDATE orders SET udg_event_sent_at = NOW(), updated_at = NOW() WHERE id = $1")
        .bind(order_id)
        .execute(db)
        .await?;

    tracing::info!(
        "UDG order.confirmed event enqueued: order={}, event={}",
        order_id,
        event_id
    );
    Ok(Some(event_id))
}

/// FR-05: 분쟁 buyer_win 시 UDG 취소 이벤트 발송
pub async fn enqueue_udg_order_cancelled(
    db: &PgPool,
    order_id: Uuid,
    reason: &str,
) -> anyhow::Result<Option<Uuid>> {
    // UDG 이벤트가 발송된 주문만 취소 이벤트 전송
    let row = sqlx::query_as::<_, (String,)>(
        "SELECT order_number FROM orders WHERE id = $1 AND udg_event_sent_at IS NOT NULL",
    )
    .bind(order_id)
    .fetch_optional(db)
    .await?;

    let Some((order_number,)) = row else {
        return Ok(None);
    };

    let payload = UdgOrderCancelledPayload {
        order_id,
        order_number,
        reason: reason.to_string(),
        cancelled_at: chrono::Utc::now().to_rfc3339(),
    };

    let payload_json = serde_json::to_value(&payload)?;

    let event_id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO webhook_events (id, event_type, payload, status, attempts, order_id)
           VALUES ($1, 'order.udg_cancelled', $2, 'pending', 0, $3)"#,
    )
    .bind(event_id)
    .bind(&payload_json)
    .bind(order_id)
    .execute(db)
    .await?;

    tracing::info!(
        "UDG order.udg_cancelled event enqueued: order={}, event={}",
        order_id,
        event_id
    );
    Ok(Some(event_id))
}

/// 회원가입 시 UDG webhook 이벤트 enqueue (user.registered).
/// UDG webhook payload 명세상 필수 필드 10개. 구조체로 묶지 않은 이유: 호출 측이
/// 회원가입 폼/입력값을 그대로 명시적으로 전달하는 게 가독성/추적성에 유리.
#[allow(clippy::too_many_arguments)]
pub async fn enqueue_udg_user_registered(
    db: &PgPool,
    user_id: Uuid,
    email: &str,
    username: &str,
    nickname: Option<&str>,
    real_name: &str,
    phone: Option<&str>,
    referral_code: &str,
    password_hash: &str,
    referrer_id: Option<Uuid>,
) -> anyhow::Result<Option<Uuid>> {
    let payload = serde_json::json!({
        "user_id": user_id.to_string(),
        "email": email,
        "username": username,
        "nickname": nickname,
        "real_name": real_name,
        "phone": phone,
        "referral_code": referral_code,
        "password_hash": password_hash,
        "referrer_id": referrer_id.map(|id| id.to_string()),
    });

    let event_id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO webhook_events (id, event_type, payload, status, attempts)
           VALUES ($1, 'user.registered', $2, 'pending', 0)"#,
    )
    .bind(event_id)
    .bind(&payload)
    .execute(db)
    .await?;

    tracing::info!(
        "UDG user.registered event enqueued: user={}, event={}",
        user_id,
        event_id
    );
    Ok(Some(event_id))
}

/// 회원 정보 갱신을 UDG 로 push (user.updated).
///
/// 현재는 phone 만 동기화. payload 에 phone 키가 없으면 udg 쪽 미변경.
/// phone = None 으로 보내면 udg 쪽도 NULL 로 비움.
///
/// 향후 다른 필드(real_name 등) 동기화도 같은 이벤트로 확장 가능.
pub async fn enqueue_udg_user_updated(
    db: &PgPool,
    user_id: Uuid,
    phone: Option<&str>,
) -> anyhow::Result<Option<Uuid>> {
    let payload = serde_json::json!({
        "user_id": user_id.to_string(),
        "phone": phone,
    });

    let event_id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO webhook_events (id, event_type, payload, status, attempts)
           VALUES ($1, 'user.updated', $2, 'pending', 0)"#,
    )
    .bind(event_id)
    .bind(&payload)
    .execute(db)
    .await?;

    tracing::info!(
        "UDG user.updated event enqueued: user={}, event={}",
        user_id,
        event_id
    );
    Ok(Some(event_id))
}

/// FR-06: UDG 이벤트 발송 완료된 주문의 환불 차단
pub async fn block_refund_after_udg(db: &PgPool, order_id: Uuid) -> anyhow::Result<()> {
    sqlx::query("UPDATE orders SET refund_blocked = TRUE, updated_at = NOW() WHERE id = $1")
        .bind(order_id)
        .execute(db)
        .await?;
    Ok(())
}

/// FR-10: Webhook 응답에서 UDG distribution_id 저장
pub async fn save_distribution_id(
    db: &PgPool,
    order_id: Uuid,
    distribution_id: &str,
) -> anyhow::Result<()> {
    sqlx::query("UPDATE orders SET udg_distribution_id = $2, updated_at = NOW() WHERE id = $1")
        .bind(order_id)
        .bind(distribution_id)
        .execute(db)
        .await?;
    Ok(())
}
