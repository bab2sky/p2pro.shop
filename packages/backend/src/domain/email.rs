use lettre::{
    message::header::ContentType, transport::smtp::authentication::Credentials, AsyncSmtpTransport,
    AsyncTransport, Message, Tokio1Executor,
};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub enum EmailTemplate {
    OrderConfirmed {
        order_number: String,
        total: String,
    },
    TxidApproved {
        order_number: String,
    },
    TxidRejected {
        order_number: String,
        reason: String,
    },
    DeliveryComplete {
        order_number: String,
        carrier: String,
        tracking: String,
    },
    SettlementComplete {
        amount: String,
        date: String,
    },
    DisputeUpdate {
        dispute_id: String,
        status: String,
        message: String,
    },
    PasswordReset {
        reset_url: String,
        user_name: String,
    },
    EmailVerification {
        code: String,
    },
}

impl EmailTemplate {
    pub fn template_key(&self) -> &'static str {
        match self {
            Self::OrderConfirmed { .. } => "order_confirmed",
            Self::TxidApproved { .. } => "txid_approved",
            Self::TxidRejected { .. } => "txid_rejected",
            Self::DeliveryComplete { .. } => "delivery_complete",
            Self::SettlementComplete { .. } => "settlement_complete",
            Self::DisputeUpdate { .. } => "dispute_update",
            Self::PasswordReset { .. } => "password_reset",
            Self::EmailVerification { .. } => "email_verification",
        }
    }

    pub fn subject(&self) -> String {
        match self {
            Self::OrderConfirmed { order_number, .. } => {
                format!("[P2PRO] 주문이 확인되었습니다 ({})", order_number)
            }
            Self::TxidApproved { order_number } => {
                format!("[P2PRO] 결제가 승인되었습니다 ({})", order_number)
            }
            Self::TxidRejected { order_number, .. } => {
                format!("[P2PRO] 결제 검증 실패 ({})", order_number)
            }
            Self::DeliveryComplete { order_number, .. } => {
                format!("[P2PRO] 배송이 완료되었습니다 ({})", order_number)
            }
            Self::SettlementComplete { amount, .. } => {
                format!("[P2PRO] 정산이 완료되었습니다 ({} USDT)", amount)
            }
            Self::DisputeUpdate { dispute_id, .. } => {
                format!("[P2PRO] 분쟁 상태 업데이트 ({})", dispute_id)
            }
            Self::PasswordReset { .. } => "[P2PRO] 비밀번호 재설정 안내".into(),
            Self::EmailVerification { .. } => "[P2PRO] 이메일 인증 코드".into(),
        }
    }

    pub fn preference_key(&self) -> &'static str {
        match self {
            Self::OrderConfirmed { .. } => "email_notify_order",
            Self::TxidApproved { .. } | Self::TxidRejected { .. } => "email_notify_payment",
            Self::DeliveryComplete { .. } => "email_notify_delivery",
            Self::SettlementComplete { .. } => "email_notify_settlement",
            Self::DisputeUpdate { .. } => "email_notify_dispute",
            Self::PasswordReset { .. } => "__always__", // bypass preference check
            Self::EmailVerification { .. } => "__always__", // bypass preference check
        }
    }

    pub fn render_html(&self) -> String {
        let body = match self {
            Self::OrderConfirmed {
                order_number,
                total,
            } => format!(
                r#"<h2>주문이 확인되었습니다</h2>
                <p>주문번호: <strong>{}</strong></p>
                <p>결제 금액: <strong>{} USDT</strong></p>
                <p>24시간 이내에 TXID를 입력하여 결제를 완료해주세요.</p>"#,
                order_number, total
            ),
            Self::TxidApproved { order_number } => format!(
                r#"<h2>결제가 승인되었습니다</h2>
                <p>주문번호: <strong>{}</strong></p>
                <p>TXID 검증이 완료되어 결제가 승인되었습니다. 셀러가 곧 상품을 발송할 예정입니다.</p>"#,
                order_number
            ),
            Self::TxidRejected {
                order_number,
                reason,
            } => format!(
                r#"<h2>결제 검증 실패</h2>
                <p>주문번호: <strong>{}</strong></p>
                <p>사유: {}</p>
                <p>새로운 TXID를 입력하거나 고객센터에 문의해주세요.</p>"#,
                order_number, reason
            ),
            Self::DeliveryComplete {
                order_number,
                carrier,
                tracking,
            } => format!(
                r#"<h2>배송이 완료되었습니다</h2>
                <p>주문번호: <strong>{}</strong></p>
                <p>택배사: {} / 운송장: {}</p>
                <p>상품 수령을 확인하시고 7일 이내에 구매확정을 해주세요.</p>"#,
                order_number, carrier, tracking
            ),
            Self::SettlementComplete { amount, date } => format!(
                r#"<h2>정산이 완료되었습니다</h2>
                <p>정산 금액: <strong>{} USDT</strong></p>
                <p>정산일: {}</p>"#,
                amount, date
            ),
            Self::DisputeUpdate {
                dispute_id,
                status,
                message,
            } => format!(
                r#"<h2>분쟁 상태 업데이트</h2>
                <p>분쟁 ID: <strong>{}</strong></p>
                <p>상태: {}</p>
                <p>{}</p>"#,
                dispute_id, status, message
            ),
            Self::PasswordReset {
                reset_url,
                user_name,
            } => format!(
                r#"<h2>비밀번호 재설정</h2>
                <p>안녕하세요, <strong>{}</strong>님.</p>
                <p>아래 버튼을 클릭하여 비밀번호를 재설정하세요.</p>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="{}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                    비밀번호 재설정
                  </a>
                </p>
                <p style="color: #888;">이 링크는 1시간 후에 만료됩니다.</p>
                <p style="color: #888;">본인이 요청하지 않은 경우 이 메일을 무시하세요.</p>"#,
                user_name, reset_url
            ),
            Self::EmailVerification { code } => format!(
                r#"<h2>이메일 인증 코드</h2>
                <p>아래 인증 코드를 입력하여 이메일을 인증해주세요.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <span style="display: inline-block; background: #f3f4f6; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px 32px; border-radius: 8px; color: #1a1a2e;">{}</span>
                </div>
                <p style="color: #888;">이 코드는 5분 후에 만료됩니다.</p>
                <p style="color: #888;">본인이 요청하지 않은 경우 이 메일을 무시하세요.</p>"#,
                code
            ),
        };

        format!(
            r#"<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #1a1a2e; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">P2PRO Store</h1>
  </div>
  <div style="border: 1px solid #e0e0e0; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
    {}
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    <p style="color: #888; font-size: 12px;">
      이 메일은 P2PRO Store에서 자동으로 발송되었습니다.<br>
      수신을 원하지 않으시면 프로필 설정에서 변경하세요.
    </p>
  </div>
</body>
</html>"#,
            body
        )
    }
}

/// Queue an email for sending. Checks user preference before inserting.
pub async fn queue_email(
    db: &sqlx::PgPool,
    user_id: Uuid,
    template: EmailTemplate,
) -> anyhow::Result<()> {
    // CRIT-06: Use CASE expression instead of format!() to prevent SQL injection
    let pref_key = template.preference_key();

    // I-10 FIX: __always__ bypasses preference check (for password reset, etc.)
    let allowed_columns = [
        "email_notify_order",
        "email_notify_payment",
        "email_notify_delivery",
        "email_notify_settlement",
        "email_notify_dispute",
        "email_notify_marketing",
        "__always__",
    ];
    if !allowed_columns.contains(&pref_key) {
        anyhow::bail!("Invalid email preference key: {}", pref_key);
    }

    // I-10 FIX: __always__ skips preference check (password reset must always send)
    let (email, enabled) = if pref_key == "__always__" {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT email FROM users WHERE id = $1 AND status = 'active'")
                .bind(user_id)
                .fetch_optional(db)
                .await?;
        match row {
            Some((e,)) => (e, true),
            None => return Ok(()),
        }
    } else {
        let row: Option<(String, bool)> = sqlx::query_as(
            r#"SELECT email, CASE
                WHEN $2 = 'email_notify_order' THEN COALESCE(email_notify_order, true)
                WHEN $2 = 'email_notify_payment' THEN COALESCE(email_notify_payment, true)
                WHEN $2 = 'email_notify_delivery' THEN COALESCE(email_notify_delivery, true)
                WHEN $2 = 'email_notify_settlement' THEN COALESCE(email_notify_settlement, true)
                WHEN $2 = 'email_notify_dispute' THEN COALESCE(email_notify_dispute, true)
                WHEN $2 = 'email_notify_marketing' THEN COALESCE(email_notify_marketing, false)
                ELSE true
            END as pref_enabled
            FROM users WHERE id = $1 AND status = 'active'"#,
        )
        .bind(user_id)
        .bind(pref_key)
        .fetch_optional(db)
        .await?;
        match row {
            Some(r) => r,
            None => return Ok(()),
        }
    };

    if !enabled {
        return Ok(());
    }

    let subject = template.subject();
    let body_html = template.render_html();
    let template_key = template.template_key();

    sqlx::query(
        r#"INSERT INTO email_logs (id, user_id, email_to, template_key, subject, body_html, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending')"#,
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&email)
    .bind(template_key)
    .bind(&subject)
    .bind(&body_html)
    .execute(db)
    .await?;

    Ok(())
}

/// Queue an email for sending directly to an email address (no user required).
/// Used for pre-signup flows like email verification where the user doesn't exist yet.
/// Requires migration 030 (email_logs.user_id nullable).
pub async fn queue_email_direct(
    db: &sqlx::PgPool,
    email_to: &str,
    template: EmailTemplate,
) -> anyhow::Result<()> {
    let subject = template.subject();
    let body_html = template.render_html();
    let template_key = template.template_key();

    sqlx::query(
        r#"INSERT INTO email_logs (id, user_id, email_to, template_key, subject, body_html, status)
           VALUES ($1, NULL, $2, $3, $4, $5, 'pending')"#,
    )
    .bind(Uuid::new_v4())
    .bind(email_to)
    .bind(template_key)
    .bind(&subject)
    .bind(&body_html)
    .execute(db)
    .await?;

    Ok(())
}

pub struct EmailSender {
    mailer: AsyncSmtpTransport<Tokio1Executor>,
    from_email: String,
    from_name: String,
}

impl EmailSender {
    pub fn new(
        host: &str,
        port: u16,
        username: &str,
        password: &str,
        from_email: &str,
        from_name: &str,
        use_tls: bool,
    ) -> anyhow::Result<Self> {
        let creds = Credentials::new(username.into(), password.into());

        let mailer = if use_tls {
            if port == 465 {
                // Implicit TLS (port 465)
                AsyncSmtpTransport::<Tokio1Executor>::relay(host)?
                    .port(port)
                    .credentials(creds)
                    .build()
            } else {
                // STARTTLS (port 587)
                AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(host)?
                    .port(port)
                    .credentials(creds)
                    .build()
            }
        } else {
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(host)
                .port(port)
                .credentials(creds)
                .build()
        };

        Ok(Self {
            mailer,
            from_email: from_email.into(),
            from_name: from_name.into(),
        })
    }

    pub async fn send(&self, to: &str, subject: &str, body_html: &str) -> anyhow::Result<()> {
        let email = Message::builder()
            .from(format!("{} <{}>", self.from_name, self.from_email).parse()?)
            .to(to.parse()?)
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(body_html.to_string())?;

        self.mailer.send(email).await?;
        Ok(())
    }
}
