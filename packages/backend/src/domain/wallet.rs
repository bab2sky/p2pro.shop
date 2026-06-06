use crate::AppError;

/// Validate USDT wallet address — BEP-20 only (operator policy v1.3.10).
///
/// BEP-20 (BNB Smart Chain): 0x-prefixed, 42 chars total, lowercase or uppercase
/// hex after the prefix. Wire-format is identical to ERC-20 / Ethereum addresses,
/// but the operating chain is BSC.
///
/// TRC-20 / 다른 체인은 더 이상 허용되지 않는다. /seller/settlement 출금
/// 흐름이 BEP-20 단일 체인을 가정하기 때문에 입력 단계에서 거부한다.
pub fn validate_wallet_address(addr: &str) -> Result<(), AppError> {
    let is_bep20 = addr.len() == 42
        && addr.starts_with("0x")
        && addr[2..].chars().all(|c| c.is_ascii_hexdigit());

    if !is_bep20 {
        return Err(AppError::Validation {
            message: "BEP-20 지갑 주소만 등록 가능합니다 (0x + 40자리 16진수).".into(),
            field: Some("wallet_address".into()),
        });
    }
    Ok(())
}
