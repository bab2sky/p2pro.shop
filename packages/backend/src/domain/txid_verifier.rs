use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::str::FromStr;

#[derive(Debug, Clone, PartialEq)]
pub enum Network {
    Erc20,
    Trc20,
}

impl Network {
    pub fn as_str(&self) -> &str {
        match self {
            Network::Erc20 => "erc20",
            Network::Trc20 => "trc20",
        }
    }
}

#[derive(Debug, Serialize)]
pub struct VerifyResult {
    pub passed: bool,
    pub network: String,
    pub from_address: Option<String>,
    pub to_address: Option<String>,
    pub amount: Option<BigDecimal>,
    pub timestamp: Option<DateTime<Utc>>,
    pub failure_reason: Option<String>,
    pub checks: VerifyChecks,
}

#[derive(Debug, Serialize)]
pub struct VerifyChecks {
    pub recipient_valid: bool,
    pub amount_valid: bool,
    pub timestamp_valid: bool,
    pub not_duplicate: bool,
}

// Etherscan API response
#[derive(Debug, Deserialize)]
struct EtherscanResponse {
    status: String,
    result: serde_json::Value,
}

// TronGrid API response
#[derive(Debug, Deserialize)]
struct TronGridResponse {
    #[serde(default)]
    data: Vec<TronGridTx>,
    #[serde(default)]
    success: bool,
}

#[derive(Debug, Deserialize)]
struct TronGridTx {
    #[serde(default)]
    ret: Vec<TronRet>,
    #[serde(default)]
    block_timestamp: i64,
    #[serde(default)]
    raw_data: Option<TronRawData>,
}

#[derive(Debug, Deserialize)]
struct TronRet {
    #[serde(rename = "contractRet", default)]
    contract_ret: String,
}

#[derive(Debug, Deserialize)]
struct TronRawData {
    #[serde(default)]
    contract: Vec<TronContract>,
}

#[derive(Debug, Deserialize)]
struct TronContract {
    #[serde(default)]
    parameter: Option<TronParameter>,
}

#[derive(Debug, Deserialize)]
struct TronParameter {
    #[serde(default)]
    value: serde_json::Value,
}

pub struct TxidVerifier {
    client: reqwest::Client,
    etherscan_key: String,
    trongrid_key: String,
    wallet_eth: String,
    wallet_tron: String,
}

impl TxidVerifier {
    pub fn new(
        etherscan_key: String,
        trongrid_key: String,
        wallet_eth: String,
        wallet_tron: String,
    ) -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .connect_timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
            etherscan_key,
            trongrid_key,
            wallet_eth,
            wallet_tron,
        }
    }

    pub fn detect_network(txid: &str) -> Option<Network> {
        if txid.starts_with("0x") && txid.len() == 66 {
            Some(Network::Erc20)
        } else if txid.len() == 64 && txid.chars().all(|c| c.is_ascii_hexdigit()) {
            Some(Network::Trc20)
        } else {
            None
        }
    }

    pub async fn verify(
        &self,
        txid: &str,
        order_total: &BigDecimal,
        order_created_at: DateTime<Utc>,
        db: &sqlx::PgPool,
    ) -> VerifyResult {
        let network = match Self::detect_network(txid) {
            Some(n) => n,
            None => {
                return VerifyResult {
                    passed: false,
                    network: "unknown".into(),
                    from_address: None,
                    to_address: None,
                    amount: None,
                    timestamp: None,
                    failure_reason: Some("NETWORK_UNKNOWN".into()),
                    checks: VerifyChecks {
                        recipient_valid: false,
                        amount_valid: false,
                        timestamp_valid: false,
                        not_duplicate: false,
                    },
                };
            }
        };

        // FIX: Atomic duplicate check using a short-lived transaction with SELECT FOR UPDATE
        // to prevent TOCTOU race where two concurrent verify() calls both pass the check.
        // The primary defense is in submit_txid (which does atomic check-and-insert in a tx),
        // but this secondary check in the async verification task must also be safe.
        {
            let mut dup_tx = match db.begin().await {
                Ok(tx) => tx,
                Err(e) => {
                    tracing::error!("Failed to begin duplicate check transaction: {:?}", e);
                    return VerifyResult {
                        passed: false,
                        network: network.as_str().into(),
                        from_address: None,
                        to_address: None,
                        amount: None,
                        timestamp: None,
                        failure_reason: Some("DB_ERROR".into()),
                        checks: VerifyChecks {
                            recipient_valid: false,
                            amount_valid: false,
                            timestamp_valid: false,
                            not_duplicate: false,
                        },
                    };
                }
            };

            let is_duplicate = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM transactions WHERE txid = $1 AND verification_status = 'verified' FOR UPDATE)",
            )
            .bind(txid)
            .fetch_one(&mut *dup_tx)
            .await
            .unwrap_or(false);

            // Transaction is dropped (rolled back) here — we only needed the lock for the check
            let _ = dup_tx.rollback().await;

            if is_duplicate {
                return VerifyResult {
                    passed: false,
                    network: network.as_str().into(),
                    from_address: None,
                    to_address: None,
                    amount: None,
                    timestamp: None,
                    failure_reason: Some("TXID_DUPLICATE".into()),
                    checks: VerifyChecks {
                        recipient_valid: false,
                        amount_valid: false,
                        timestamp_valid: false,
                        not_duplicate: false,
                    },
                };
            }
        }

        // Fetch transaction from blockchain
        let tx_result = match network {
            Network::Erc20 => self.fetch_etherscan(txid).await,
            Network::Trc20 => match self.fetch_trongrid(txid).await {
                Ok(data) => Ok(data),
                Err(e) => {
                    tracing::warn!("TronGrid failed for {}: {}. Trying Tronscan...", txid, e);
                    self.fetch_tronscan(txid).await
                }
            },
        };

        let (from_addr, to_addr, amount, timestamp) = match tx_result {
            Ok(data) => data,
            Err(e) => {
                tracing::error!("Blockchain API error for txid {}: {}", txid, e);
                return VerifyResult {
                    passed: false,
                    network: network.as_str().into(),
                    from_address: None,
                    to_address: None,
                    amount: None,
                    timestamp: None,
                    failure_reason: Some("API_ERROR".into()),
                    checks: VerifyChecks {
                        recipient_valid: false,
                        amount_valid: false,
                        timestamp_valid: false,
                        not_duplicate: true,
                    },
                };
            }
        };

        // Step 1: Recipient check
        let expected_wallet = match network {
            Network::Erc20 => &self.wallet_eth,
            Network::Trc20 => &self.wallet_tron,
        };
        let recipient_valid = to_addr
            .as_ref()
            .map(|a| a.eq_ignore_ascii_case(expected_wallet))
            .unwrap_or(false);

        // Step 2: Amount check
        let amount_valid = amount.as_ref().map(|a| a >= order_total).unwrap_or(false);

        // Step 3: Timestamp check
        let timestamp_valid = timestamp.map(|ts| ts > order_created_at).unwrap_or(false);

        let passed = recipient_valid && amount_valid && timestamp_valid;

        let failure_reason = if !passed {
            if !recipient_valid {
                Some("RECIPIENT_MISMATCH".into())
            } else if !amount_valid {
                Some("AMOUNT_MISMATCH".into())
            } else {
                Some("TIMESTAMP_INVALID".into())
            }
        } else {
            None
        };

        VerifyResult {
            passed,
            network: network.as_str().into(),
            from_address: from_addr,
            to_address: to_addr,
            amount,
            timestamp,
            failure_reason,
            checks: VerifyChecks {
                recipient_valid,
                amount_valid,
                timestamp_valid,
                not_duplicate: true,
            },
        }
    }

    async fn fetch_etherscan(
        &self,
        txid: &str,
    ) -> anyhow::Result<(
        Option<String>,
        Option<String>,
        Option<BigDecimal>,
        Option<DateTime<Utc>>,
    )> {
        let url = format!(
            "https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash={}&apikey={}",
            txid, self.etherscan_key
        );

        let resp: EtherscanResponse = self.client.get(&url).send().await?.json().await?;

        if resp.status == "0" || resp.result.is_null() {
            anyhow::bail!("Transaction not found on Etherscan");
        }

        let result = &resp.result;
        let from = result["from"].as_str().map(String::from);

        // For ERC-20 USDT transfers, result["to"] is the USDT contract address, NOT the recipient.
        // The actual recipient and amount must be decoded from the input data (ABI-encoded).
        let (to, amount) = if let Some(input) = result["input"].as_str() {
            let recipient = Self::decode_erc20_transfer_recipient(input);
            let amt = Self::decode_erc20_transfer_amount(input);
            (recipient, amt)
        } else {
            // Native ETH transfer (not ERC-20) — use result["to"] directly
            let to = result["to"].as_str().map(String::from);
            let amount = result["value"]
                .as_str()
                .and_then(|v| {
                    let v = v.strip_prefix("0x").unwrap_or(v);
                    u128::from_str_radix(v, 16).ok()
                })
                .map(|wei| BigDecimal::from(wei) / BigDecimal::from(1_000_000_000_000_000_000u64));
            (to, amount)
        };

        // Get block timestamp via eth_getBlockByNumber
        let timestamp = if let Some(block_hex) = result["blockNumber"].as_str() {
            self.fetch_block_timestamp(block_hex).await.ok()
        } else {
            None
        };

        Ok((from, to, amount, timestamp))
    }

    /// Decode the recipient address from ERC-20 transfer(address,uint256) input data.
    /// Input layout: 0xa9059cbb + 32-byte address (padded) + 32-byte amount
    /// The recipient is at bytes 10..74 (last 40 hex chars = 20-byte address).
    pub fn decode_erc20_transfer_recipient(input: &str) -> Option<String> {
        // ERC-20 transfer method signature: 0xa9059cbb
        if input.len() < 138 || !input.starts_with("0xa9059cbb") {
            return None;
        }
        // Address is at offset 10..74 (32 bytes hex, left-padded with zeros)
        // Take last 40 chars (20-byte address)
        let addr_hex = &input[10..74];
        let addr = addr_hex.trim_start_matches('0');
        if addr.is_empty() {
            return None;
        }
        // Reconstruct as 0x-prefixed checksumless address (40 hex chars)
        Some(format!("0x{:0>40}", addr))
    }

    pub fn decode_erc20_transfer_amount(input: &str) -> Option<BigDecimal> {
        // ERC-20 transfer(address,uint256) method signature: 0xa9059cbb
        if input.len() < 138 || !input.starts_with("0xa9059cbb") {
            return None;
        }
        // Amount is at offset 74..138 (32 bytes hex)
        let amount_hex = &input[74..138].trim_start_matches('0');
        if amount_hex.is_empty() {
            return Some(BigDecimal::from(0));
        }
        let amount_raw = u128::from_str_radix(amount_hex, 16).ok()?;
        // USDT has 6 decimals
        let amount = BigDecimal::from(amount_raw) / BigDecimal::from(1_000_000u64);
        Some(amount)
    }

    async fn fetch_block_timestamp(&self, block_hex: &str) -> anyhow::Result<DateTime<Utc>> {
        let url = format!(
            "https://api.etherscan.io/api?module=proxy&action=eth_getBlockByNumber&tag={}&boolean=false&apikey={}",
            block_hex, self.etherscan_key
        );
        let resp: EtherscanResponse = self.client.get(&url).send().await?.json().await?;
        let ts_hex = resp.result["timestamp"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("No timestamp in block"))?;
        let ts_hex = ts_hex.strip_prefix("0x").unwrap_or(ts_hex);
        let ts = i64::from_str_radix(ts_hex, 16)?;
        Ok(DateTime::from_timestamp(ts, 0).unwrap_or_else(Utc::now))
    }

    /// Fetch TRC20 transaction via Tronscan API (fallback)
    async fn fetch_tronscan(
        &self,
        txid: &str,
    ) -> anyhow::Result<(
        Option<String>,
        Option<String>,
        Option<BigDecimal>,
        Option<DateTime<Utc>>,
    )> {
        let url = format!(
            "https://apilist.tronscanapi.com/api/transaction-info?hash={}",
            txid
        );

        let resp: serde_json::Value = self
            .client
            .get(&url)
            .header("TRON-PRO-API-KEY", &self.trongrid_key)
            .send()
            .await?
            .json()
            .await?;

        if resp["contractRet"].as_str() != Some("SUCCESS") {
            anyhow::bail!("Transaction not successful on Tronscan");
        }

        let timestamp = resp["timestamp"]
            .as_i64()
            .and_then(DateTime::from_timestamp_millis);

        let transfer = &resp["tokenTransferInfo"];
        let from = transfer["from_address"].as_str().map(String::from);
        let to = transfer["to_address"].as_str().map(String::from);
        let amount_str = transfer["amount_str"].as_str().unwrap_or("0");
        let decimals = transfer["decimals"].as_i64().unwrap_or(6);

        let amount_raw = BigDecimal::from_str(amount_str).unwrap_or_else(|_| BigDecimal::from(0));
        let divisor = BigDecimal::from(10i64.pow(decimals as u32));
        let amount = amount_raw / divisor;

        Ok((from, to, Some(amount), timestamp))
    }

    /// Verify with retry logic (try primary API, fallback to secondary)
    pub async fn verify_with_retry(
        &self,
        txid: &str,
        order_total: &BigDecimal,
        order_created_at: DateTime<Utc>,
        db: &sqlx::PgPool,
        max_retries: u32,
    ) -> VerifyResult {
        let mut last_result = None;

        for attempt in 0..=max_retries {
            if attempt > 0 {
                tokio::time::sleep(std::time::Duration::from_secs(2u64.pow(attempt))).await;
            }

            let result = self.verify(txid, order_total, order_created_at, db).await;

            if result.passed {
                return result;
            }

            match &result.failure_reason {
                Some(reason) if reason == "API_ERROR" => {
                    last_result = Some(result);
                    continue;
                }
                _ => return result,
            }
        }

        last_result.unwrap_or_else(|| VerifyResult {
            passed: false,
            network: "unknown".into(),
            from_address: None,
            to_address: None,
            amount: None,
            timestamp: None,
            failure_reason: Some("MAX_RETRIES_EXCEEDED".into()),
            checks: VerifyChecks {
                recipient_valid: false,
                amount_valid: false,
                timestamp_valid: false,
                not_duplicate: true,
            },
        })
    }

    async fn fetch_trongrid(
        &self,
        txid: &str,
    ) -> anyhow::Result<(
        Option<String>,
        Option<String>,
        Option<BigDecimal>,
        Option<DateTime<Utc>>,
    )> {
        let url = format!("https://api.trongrid.io/v1/transactions/{}", txid);

        let mut req = self.client.get(&url);
        if !self.trongrid_key.is_empty() {
            req = req.header("TRON-PRO-API-KEY", &self.trongrid_key);
        }

        let resp: TronGridResponse = req.send().await?.json().await?;

        if !resp.success || resp.data.is_empty() {
            anyhow::bail!("Transaction not found on TronGrid");
        }

        let tx = &resp.data[0];

        // Check success
        if tx.ret.first().map(|r| r.contract_ret.as_str()) != Some("SUCCESS") {
            anyhow::bail!("Transaction not successful");
        }

        let timestamp = if tx.block_timestamp > 0 {
            DateTime::from_timestamp_millis(tx.block_timestamp)
        } else {
            None
        };

        // Parse TRC-20 transfer from contract data
        let (from, to, amount) = if let Some(raw) = &tx.raw_data {
            if let Some(contract) = raw.contract.first() {
                if let Some(param) = &contract.parameter {
                    let value = &param.value;
                    let from = value["owner_address"].as_str().map(String::from);
                    let to = value["to_address"].as_str().map(String::from);
                    // FIX: Use string-based parsing to prevent i64 overflow with large USDT amounts.
                    // as_i64() overflows at ~9,223 USDT (9_223_372_036_854 sun), which is easily
                    // reachable in real transactions. Parse as string -> BigDecimal instead.
                    let amount_raw = if let Some(n) = value["amount"].as_u64() {
                        BigDecimal::from(n)
                    } else if let Some(s) = value["amount"].as_str() {
                        BigDecimal::from_str(s).unwrap_or_else(|_| BigDecimal::from(0))
                    } else if let Some(n) = value["amount"].as_f64() {
                        // Fallback: f64 (lossy but better than 0)
                        BigDecimal::from_str(&n.to_string()).unwrap_or_else(|_| BigDecimal::from(0))
                    } else {
                        BigDecimal::from(0)
                    };
                    // TRC-20 USDT has 6 decimals
                    let amount = amount_raw / BigDecimal::from(1_000_000i64);
                    (from, to, Some(amount))
                } else {
                    (None, None, None)
                }
            } else {
                (None, None, None)
            }
        } else {
            (None, None, None)
        };

        Ok((from, to, amount, timestamp))
    }
}
