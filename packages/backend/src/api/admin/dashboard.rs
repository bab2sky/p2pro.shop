use axum::{extract::State, Extension, Json};
use bigdecimal::BigDecimal;

use crate::domain::admin::*;
use crate::middleware::auth::AuthUser;
use crate::{AppError, AppState};

pub async fn dashboard(
    State(state): State<AppState>,
    Extension(_auth): Extension<AuthUser>,
) -> Result<Json<DashboardResponse>, AppError> {
    // Main stats: orders + revenue
    let stats_row = sqlx::query_as::<_, (i64, i64, i64, i64, Option<BigDecimal>, i64, Option<BigDecimal>,
                                         i64, i64, i64, i64, i64, i64, i64,
                                         Option<BigDecimal>, Option<BigDecimal>)>(
        r#"WITH order_stats AS (
            SELECT
                COUNT(*) as total_orders,
                COUNT(*) FILTER (WHERE status = 'pending_payment') as pending_payments,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_orders,
                -- 매출 = settlement / seller profit summary 와 동일 status 정책
                -- (delivered/confirmed only). 진행 중 상태(payment_verified,
                -- preparing, shipped 등)는 미실현이라 제외 — 셀러 화면과
                -- 관리자 대시보드 합계 정합 보장.
                COALESCE(SUM(total_amount) FILTER (WHERE status IN ('delivered', 'confirmed')), 0) as total_revenue,
                COALESCE(SUM(total_amount) FILTER (WHERE created_at >= CURRENT_DATE AND status IN ('delivered', 'confirmed')), 0) as today_revenue,
                COUNT(*) FILTER (WHERE status = 'shipped') as shipped_orders,
                COUNT(*) FILTER (WHERE status = 'delivered') as delivered_orders,
                COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_orders,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
                COALESCE(SUM(total_amount) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' AND status IN ('delivered', 'confirmed')), 0) as week_revenue,
                COALESCE(SUM(total_amount) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' AND status IN ('delivered', 'confirmed')), 0) as month_revenue
            FROM orders
        ),
        other_stats AS (
            SELECT
                (SELECT COUNT(*) FROM transactions WHERE verification_status IN ('pending', 'failed')) as pending_txid,
                (SELECT COUNT(*) FROM products WHERE status = 'pending') as pending_products,
                (SELECT COUNT(*) FROM seller_profiles WHERE status = 'approved') as active_sellers,
                (SELECT COUNT(*) FROM users WHERE withdrawn_at IS NULL) as total_users,
                (SELECT COUNT(*) FROM seller_profiles WHERE status = 'pending') as pending_sellers
        )
        SELECT os.total_orders, os.pending_payments, ot.pending_txid, ot.pending_products,
               os.total_revenue, os.today_orders, os.today_revenue,
               ot.active_sellers, ot.total_users, ot.pending_sellers,
               os.shipped_orders, os.delivered_orders, os.confirmed_orders, os.cancelled_orders,
               os.week_revenue, os.month_revenue
        FROM order_stats os, other_stats ot"#,
    ).fetch_one(&state.db).await?;

    let (
        total_orders,
        pending_payments,
        pending_txid_verify,
        pending_products,
        total_revenue,
        today_orders,
        today_revenue,
        active_sellers,
        total_users,
        pending_sellers,
        shipped_orders,
        delivered_orders,
        confirmed_orders,
        cancelled_orders,
        week_revenue,
        month_revenue,
    ) = stats_row;

    let total_revenue = total_revenue.unwrap_or_else(|| BigDecimal::from(0));
    let today_revenue = today_revenue.unwrap_or_else(|| BigDecimal::from(0));
    let week_revenue = week_revenue.unwrap_or_else(|| BigDecimal::from(0));
    let month_revenue = month_revenue.unwrap_or_else(|| BigDecimal::from(0));

    // Extended counts
    let ext_row = sqlx::query_as::<_, (i64, i64, i64, i64, i64, i64)>(
        r#"SELECT
            (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days' AND withdrawn_at IS NULL) as new_users_7d,
            (SELECT COUNT(*) FROM products) as total_products,
            (SELECT COUNT(*) FROM products WHERE status = 'active') as active_products,
            (SELECT COUNT(*) FROM disputes WHERE status IN ('open', 'in_progress')) as open_disputes,
            (SELECT COUNT(*) FROM refund_requests WHERE status IN ('requested', 'seller_approved')) as pending_refunds,
            (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'pending') as pending_withdrawals"#,
    ).fetch_one(&state.db).await?;

    let (
        new_users_7d,
        total_products,
        active_products,
        open_disputes,
        pending_refunds,
        pending_withdrawals,
    ) = ext_row;

    // Recent orders
    let recent_orders = sqlx::query_as::<_, RecentOrder>(
        r#"SELECT o.id, o.order_number,
                  COALESCE(u.nickname, u.username) as buyer_name,
                  o.total_amount, o.status, o.created_at
           FROM orders o JOIN users u ON u.id = o.buyer_id
           ORDER BY o.created_at DESC LIMIT 10"#,
    )
    .fetch_all(&state.db)
    .await?;

    // Order status breakdown
    let status_rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT status, COUNT(*) as count FROM orders GROUP BY status ORDER BY count DESC",
    )
    .fetch_all(&state.db)
    .await?;

    let order_status_breakdown: Vec<OrderStatusBreakdown> = status_rows
        .into_iter()
        .map(|(status, count)| OrderStatusBreakdown { status, count })
        .collect();

    // Recent activities (admin logs)
    let recent_activities = sqlx::query_as::<_, RecentActivity>(
        r#"SELECT action, target_type, detail, created_at
           FROM admin_logs
           ORDER BY created_at DESC LIMIT 8"#,
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Ok(Json(DashboardResponse {
        data: DashboardData {
            stats: DashboardStats {
                total_orders,
                pending_payments,
                pending_txid_verify,
                pending_products,
                total_revenue,
                today_orders,
                today_revenue,
                active_sellers,
                total_users,
                shipped_orders,
                delivered_orders,
                confirmed_orders,
                cancelled_orders,
                new_users_7d,
                total_products,
                active_products,
                open_disputes,
                pending_refunds,
                pending_withdrawals,
                week_revenue,
                month_revenue,
            },
            recent_orders,
            pending_actions: PendingActions {
                products: pending_products,
                txid: pending_txid_verify,
                sellers: pending_sellers,
                refunds: pending_refunds,
                disputes: open_disputes,
                withdrawals: pending_withdrawals,
            },
            order_status_breakdown,
            recent_activities,
        },
    }))
}
