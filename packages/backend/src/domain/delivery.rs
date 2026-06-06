use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrackingEvent {
    pub time: DateTime<Utc>,
    pub location: String,
    pub description: String,
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct SweetTrackerResponse {
    pub result: String,
    #[serde(rename = "trackingDetails")]
    pub tracking_details: Option<Vec<SweetTrackerDetail>>,
    pub complete: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SweetTrackerDetail {
    pub time: Option<String>,
    #[serde(rename = "where")]
    pub where_str: Option<String>,
    pub kind: Option<String>,
}

pub struct DeliveryTracker {
    client: reqwest::Client,
    api_key: String,
    api_url: String,
}

impl DeliveryTracker {
    pub fn new(api_key: String, api_url: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key,
            api_url,
        }
    }

    /// Fetch tracking info from SweetTracker API
    pub async fn fetch_tracking(
        &self,
        carrier_code: &str,
        tracking_number: &str,
    ) -> anyhow::Result<(Vec<TrackingEvent>, bool)> {
        let url = format!(
            "{}/trackingInfo?t_key={}&t_code={}&t_invoice={}",
            self.api_url, self.api_key, carrier_code, tracking_number
        );

        let resp: SweetTrackerResponse = self.client.get(&url).send().await?.json().await?;

        if resp.result != "Y" {
            anyhow::bail!("SweetTracker API error: result={}", resp.result);
        }

        let mut events = Vec::new();

        if let Some(details) = resp.tracking_details {
            for d in details {
                let time_str = d.time.unwrap_or_default();
                let time = chrono::NaiveDateTime::parse_from_str(&time_str, "%Y-%m-%d %H:%M:%S")
                    .map(|ndt| ndt.and_utc())
                    .unwrap_or_else(|_| Utc::now());

                events.push(TrackingEvent {
                    time,
                    location: d.where_str.unwrap_or_default(),
                    description: d.kind.unwrap_or_default(),
                    status: "in_transit".into(),
                });
            }
        }

        // 최신순 (내림차순) 정렬: sort_by_key + Reverse (DateTime 은 Copy)
        events.sort_by_key(|e| std::cmp::Reverse(e.time));

        let is_complete = resp.complete.unwrap_or(false);

        Ok((events, is_complete))
    }
}
