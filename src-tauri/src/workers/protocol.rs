#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub(crate) mod methods {
    pub(crate) const WORKER_PING: &str = "worker.ping";
    pub(crate) const WORKER_HEALTH: &str = "worker.health";
    pub(crate) const WORKER_SHUTDOWN: &str = "worker.shutdown";

    pub(crate) const PLAYER_SET_CACHE_DIR: &str = "player.setCacheDir";
    pub(crate) const PLAYER_OUTPUT_DEVICES: &str = "player.outputDevices";
    pub(crate) const PLAYER_PLAY_PATH: &str = "player.playPath";
    pub(crate) const PLAYER_PLAY_URL: &str = "player.playUrl";
    pub(crate) const PLAYER_PAUSE: &str = "player.pause";
    pub(crate) const PLAYER_STOP: &str = "player.stop";
    pub(crate) const PLAYER_SEEK: &str = "player.seek";
    pub(crate) const PLAYER_SET_VOLUME: &str = "player.setVolume";
    pub(crate) const PLAYER_SET_SPEED: &str = "player.setSpeed";
    pub(crate) const PLAYER_SET_OUTPUT_DEVICE: &str = "player.setOutputDevice";
    pub(crate) const PLAYER_STATE: &str = "player.state";

    pub(crate) const DOWNLOAD_TRACK: &str = "download.track";
    pub(crate) const DOWNLOAD_ENQUEUE: &str = "download.enqueue";
    pub(crate) const DOWNLOAD_EVENT: &str = "download.event";

    pub(crate) const PLUGIN_FETCH_CATALOG: &str = "plugin.fetchCatalog";
    pub(crate) const PLUGIN_READ_WASM_BYTES: &str = "plugin.readWasmBytes";
    pub(crate) const PLUGIN_HTTP_REQUEST: &str = "plugin.httpRequest";
    pub(crate) const PLUGIN_INVOKE: &str = "plugin.invoke";

    pub(crate) const SCAN_MUSIC_DIR: &str = "scan.musicDir";
    pub(crate) const SCAN_TRACK: &str = "scan.track";
}

#[derive(Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkerRequest {
    pub(crate) id: String,
    pub(crate) method: String,
    pub(crate) payload: Value,
}

#[derive(Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub(crate) enum WorkerMessage {
    Response {
        id: String,
        ok: bool,
        payload: Option<Value>,
        error: Option<String>,
    },
    Event {
        name: String,
        payload: Value,
    },
}

pub(crate) fn encode_line<T: Serialize>(message: &T) -> Result<String, String> {
    let mut line = serde_json::to_string(message).map_err(|err| err.to_string())?;
    line.push('\n');
    Ok(line)
}

pub(crate) fn decode_request(line: &str) -> Result<WorkerRequest, String> {
    serde_json::from_str(line).map_err(|err| err.to_string())
}

pub(crate) fn decode_message(line: &str) -> Result<WorkerMessage, String> {
    serde_json::from_str(line).map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn encodes_response_as_single_json_line() {
        let message = WorkerMessage::Response {
            id: "play-1".to_string(),
            ok: true,
            payload: Some(json!({ "position": 0.0 })),
            error: None,
        };

        let line = encode_line(&message).expect("response should encode");

        assert!(line.ends_with('\n'));
        assert_eq!(line.lines().count(), 1);
        assert!(line.contains("\"type\":\"response\""));
    }

    #[test]
    fn decodes_worker_request_line() {
        let request = decode_request(
            r#"{"id":"play-1","method":"player.playPath","payload":{"path":"D:\\music\\a.flac"}}"#,
        )
        .expect("request should decode");

        assert_eq!(request.id, "play-1");
        assert_eq!(request.method, methods::PLAYER_PLAY_PATH);
        assert_eq!(request.payload["path"], "D:\\music\\a.flac");
    }
}
