use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Request {
    pub api_version: u32,
    pub request_id: String,
    pub method: String,
    pub params: Value,
}

#[derive(Debug, Serialize, PartialEq)]
pub(crate) struct Error {
    pub code: &'static str,
    pub message: String,
}

impl Error {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }
}

pub(crate) type Result<T> = std::result::Result<T, Error>;

// Serialize a boolean discriminator, matching the SDK rather than serde's string tags.
pub(crate) fn response(request_id: &str, result: Result<Value>) -> Value {
    match result {
        Ok(data) => serde_json::json!({"requestId": request_id, "ok": true, "data": data}),
        Err(error) => serde_json::json!({"requestId": request_id, "ok": false, "error": error}),
    }
}
