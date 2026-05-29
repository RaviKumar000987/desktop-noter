use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum HostMessage {
    Activate { extension_id: String },
    Deactivate { extension_id: String },
    Event { name: String, payload: serde_json::Value },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ExtensionMessage {
    Ready { extension_id: String },
    Result { request_id: u64, data: serde_json::Value },
    Error { request_id: u64, message: String },
}
