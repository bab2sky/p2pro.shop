/// Unit tests for TXID verifier logic (C-5: Critical test coverage)
/// Tests ERC-20 ABI decoding and network detection without external API calls.

#[test]
fn test_detect_erc20_network() {
    use p2pro_backend::domain::txid_verifier::TxidVerifier;

    // Valid ERC-20 TXID (0x + 64 hex chars)
    let txid = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    let network = TxidVerifier::detect_network(txid);
    assert!(network.is_some());
    assert_eq!(network.unwrap().as_str(), "erc20");
}

#[test]
fn test_detect_trc20_network() {
    use p2pro_backend::domain::txid_verifier::TxidVerifier;

    // Valid TRC-20 TXID (64 hex chars, no 0x prefix)
    let txid = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    let network = TxidVerifier::detect_network(txid);
    assert!(network.is_some());
    assert_eq!(network.unwrap().as_str(), "trc20");
}

#[test]
fn test_detect_invalid_network() {
    use p2pro_backend::domain::txid_verifier::TxidVerifier;

    assert!(TxidVerifier::detect_network("invalid").is_none());
    assert!(TxidVerifier::detect_network("0xshort").is_none());
    assert!(TxidVerifier::detect_network("").is_none());
}

#[test]
fn test_decode_erc20_transfer_recipient() {
    use p2pro_backend::domain::txid_verifier::TxidVerifier;

    // transfer(address,uint256) with recipient 0xdAC17F958D2ee523a2206206994597C13D831ec7
    // and amount 1000000 (1 USDT)
    let input = "0xa9059cbb000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec700000000000000000000000000000000000000000000000000000000000f4240";
    let recipient = TxidVerifier::decode_erc20_transfer_recipient(input);
    assert!(recipient.is_some());
    assert_eq!(
        recipient.unwrap().to_lowercase(),
        "0xdac17f958d2ee523a2206206994597c13d831ec7"
    );
}

#[test]
fn test_decode_erc20_transfer_amount() {
    use bigdecimal::BigDecimal;
    use p2pro_backend::domain::txid_verifier::TxidVerifier;
    use std::str::FromStr;

    // 0xF4240 = 1000000 = 1 USDT (6 decimals)
    let input = "0xa9059cbb000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec700000000000000000000000000000000000000000000000000000000000f4240";
    let amount = TxidVerifier::decode_erc20_transfer_amount(input);
    assert!(amount.is_some());
    assert_eq!(amount.unwrap(), BigDecimal::from_str("1").unwrap());
}

#[test]
fn test_decode_erc20_large_amount() {
    use bigdecimal::BigDecimal;
    use p2pro_backend::domain::txid_verifier::TxidVerifier;
    use std::str::FromStr;

    // 100 USDT = 100000000 = 0x5F5E100
    let input = "0xa9059cbb000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000005f5e100";
    let amount = TxidVerifier::decode_erc20_transfer_amount(input);
    assert!(amount.is_some());
    assert_eq!(amount.unwrap(), BigDecimal::from_str("100").unwrap());
}

#[test]
fn test_decode_erc20_invalid_input() {
    use p2pro_backend::domain::txid_verifier::TxidVerifier;

    // Not a transfer method
    assert!(TxidVerifier::decode_erc20_transfer_amount("0x12345678").is_none());
    assert!(TxidVerifier::decode_erc20_transfer_recipient("0x12345678").is_none());

    // Too short
    assert!(TxidVerifier::decode_erc20_transfer_amount("0xa9059cbb00").is_none());
    assert!(TxidVerifier::decode_erc20_transfer_recipient("0xa9059cbb00").is_none());
}
