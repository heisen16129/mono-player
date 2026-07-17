use crate::{
    plugins::PluginHttpResponse,
    workers::{
        lifecycle::{RestartPolicy, WorkerRuntimeStatus},
        manager::WorkerProcess,
        protocol::{decode_request, encode_line, methods, WorkerMessage, WorkerRequest},
        PLUGIN_WORKER_FLAG,
    },
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    io::{self, BufRead, Write},
    path::Path,
    sync::Mutex,
};
use wasmtime::{Engine, Instance, Memory, Module, Store};

const NETWORK_PERMISSION: &str = "network";
const MAX_PLUGIN_HEADER_COUNT: usize = 32;
const MAX_PLUGIN_HEADER_VALUE_BYTES: usize = 8 * 1024;
const MAX_PLUGIN_HOST_REQUESTS: usize = 16;
const MAX_PLUGIN_JSON_BYTES: usize = 8 * 1024 * 1024;

fn log_plugin_args(method: &str, args: Value) {
    if should_skip_plugin_log(method, &args) {
        return;
    }
    eprintln!("[plugin-rust] {method} args={args}");
}

fn should_skip_plugin_log(method: &str, args: &Value) -> bool {
    method == "search_native_plugin" || value_has_plugin_search_payload(args)
}

fn value_has_plugin_search_payload(value: &Value) -> bool {
    if value.get("action").and_then(Value::as_str) == Some("search") {
        return true;
    }
    if value.get("tracks").and_then(Value::as_array).is_some() {
        return true;
    }

    match value {
        Value::Array(items) => items.iter().any(value_has_plugin_search_payload),
        Value::Object(map) => map.values().any(value_has_plugin_search_payload),
        _ => false,
    }
}

pub(crate) struct PluginWorkerState {
    worker: Mutex<WorkerProcess>,
}

impl PluginWorkerState {
    pub(crate) fn start() -> Result<Self, String> {
        log_plugin_args("PluginWorkerState::start", json!({}));
        Ok(Self {
            worker: Mutex::new(start_plugin_worker()?),
        })
    }

    pub(crate) fn restart_policy(&self) -> RestartPolicy {
        RestartPolicy::RestartOnceAndRetry
    }

    pub(crate) fn fetch_plugin_catalog(&self, url: String) -> Result<String, String> {
        log_plugin_args(
            "PluginWorkerState::fetch_plugin_catalog",
            json!({ "url": url }),
        );
        self.deserialize_response(WorkerRequest {
            id: "plugin-fetch-catalog".to_string(),
            method: methods::PLUGIN_FETCH_CATALOG.to_string(),
            payload: json!({ "url": url }),
        })
    }

    pub(crate) fn read_plugin_wasm_bytes(&self, entry: String) -> Result<Vec<u8>, String> {
        log_plugin_args(
            "PluginWorkerState::read_plugin_wasm_bytes",
            json!({ "entry": entry }),
        );
        self.deserialize_response(WorkerRequest {
            id: "plugin-read-wasm".to_string(),
            method: methods::PLUGIN_READ_WASM_BYTES.to_string(),
            payload: json!({ "entry": entry }),
        })
    }

    pub(crate) fn plugin_http_request(
        &self,
        method: String,
        url: String,
        headers: Option<HashMap<String, String>>,
        data: Option<String>,
        plugin_id: Option<String>,
        permissions: Option<Vec<String>>,
    ) -> Result<PluginHttpResponse, String> {
        log_plugin_args(
            "PluginWorkerState::plugin_http_request",
            json!({
                "method": method,
                "url": url,
                "headers": headers,
                "data": data,
                "pluginId": plugin_id,
                "permissions": permissions,
            }),
        );
        self.deserialize_response(WorkerRequest {
            id: "plugin-http-request".to_string(),
            method: methods::PLUGIN_HTTP_REQUEST.to_string(),
            payload: json!({
                "method": method,
                "url": url,
                "headers": headers,
                "data": data,
                "pluginId": plugin_id,
                "permissions": permissions,
            }),
        })
    }

    pub(crate) fn invoke_plugin(
        &self,
        entry: String,
        request: Value,
        plugin_id: Option<String>,
        permissions: Option<Vec<String>>,
    ) -> Result<Value, String> {
        log_plugin_args(
            "PluginWorkerState::invoke_plugin",
            json!({
                "entry": entry,
                "request": request,
                "pluginId": plugin_id,
                "permissions": permissions,
            }),
        );
        let response: Result<Value, String> = self.deserialize_response(WorkerRequest {
            id: "plugin-invoke".to_string(),
            method: methods::PLUGIN_INVOKE.to_string(),
            payload: json!({
                "entry": entry,
                "request": request,
                "pluginId": plugin_id,
                "permissions": permissions,
            }),
        });
        match response {
            Ok(response) => {
                log_plugin_args(
                    "PluginWorkerState::invoke_plugin response",
                    json!({ "response": response.clone() }),
                );
                Ok(response)
            }
            Err(error) => {
                log_plugin_args(
                    "PluginWorkerState::invoke_plugin error",
                    json!({ "error": error }),
                );
                Err(error)
            }
        }
    }

    pub(crate) fn status(&self) -> WorkerRuntimeStatus {
        match self.worker.lock() {
            Ok(mut worker) => worker.status(),
            Err(error) => WorkerRuntimeStatus::stopped("plugin", Some(error.to_string())),
        }
    }

    #[allow(dead_code)]
    pub(crate) fn restart_process(&self) -> Result<(), String> {
        let mut worker = self.worker.lock().map_err(|err| err.to_string())?;
        worker.stop();
        *worker = start_plugin_worker()?;
        Ok(())
    }

    #[allow(dead_code)]
    pub(crate) fn stop_process(&self) -> Result<(), String> {
        self.worker.lock().map_err(|err| err.to_string())?.stop();
        Ok(())
    }

    fn request(&self, request: &WorkerRequest) -> Result<WorkerMessage, String> {
        let mut worker = self.worker.lock().map_err(|err| err.to_string())?;
        match worker.request(request) {
            Ok(message) => Ok(message),
            Err(first_error) => {
                let mut restarted_worker = start_plugin_worker()?;
                let message = restarted_worker.request(request).map_err(|retry_error| {
                    format!(
                        "plugin worker restarted after error ({first_error}); retry failed: {retry_error}"
                    )
                })?;
                *worker = restarted_worker;
                Ok(message)
            }
        }
    }

    fn deserialize_response<T: for<'de> Deserialize<'de>>(
        &self,
        request: WorkerRequest,
    ) -> Result<T, String> {
        match self.request(&request)? {
            WorkerMessage::Response {
                ok: true,
                payload: Some(payload),
                ..
            } => serde_json::from_value(payload).map_err(|err| err.to_string()),
            WorkerMessage::Response {
                error: Some(error), ..
            } => Err(error),
            message => Err(format!("unexpected plugin worker response: {message:?}")),
        }
    }
}

fn start_plugin_worker() -> Result<WorkerProcess, String> {
    log_plugin_args("start_plugin_worker", json!({}));
    let mut worker = WorkerProcess::spawn_current_exe("plugin", PLUGIN_WORKER_FLAG, &[])?;
    let request = WorkerRequest {
        id: "plugin-worker-startup".to_string(),
        method: methods::WORKER_PING.to_string(),
        payload: json!({ "source": "tauri-setup" }),
    };
    match worker.request(&request)? {
        WorkerMessage::Response { ok: true, .. } => Ok(worker),
        WorkerMessage::Response {
            error: Some(error), ..
        } => Err(error),
        message => Err(format!(
            "unexpected plugin worker startup response: {message:?}"
        )),
    }
}

pub(crate) fn run() -> Result<(), String> {
    log_plugin_args("plugin_worker::run", json!({}));
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let started_at_ms = crate::workers::worker_started_at_ms();

    for line in stdin.lock().lines() {
        let line = line.map_err(|err| err.to_string())?;
        if line.trim().is_empty() {
            continue;
        }

        let response = match decode_request(&line) {
            Ok(request) => handle_request(request, started_at_ms),
            Err(error) => WorkerMessage::Response {
                id: "invalid-request".to_string(),
                ok: false,
                payload: None,
                error: Some(error),
            },
        };
        let should_shutdown = matches!(
            &response,
            WorkerMessage::Response {
                ok: true,
                payload: Some(payload),
                ..
            } if payload.get("shutdown").and_then(Value::as_bool) == Some(true)
        );

        write_message(&mut stdout, &response)?;

        if should_shutdown {
            break;
        }
    }

    Ok(())
}

fn handle_request(request: WorkerRequest, started_at_ms: u128) -> WorkerMessage {
    log_plugin_args(
        "handle_request",
        json!({
            "id": request.id,
            "method": request.method,
            "payload": request.payload,
            "startedAtMs": started_at_ms,
        }),
    );
    match request.method.as_str() {
        methods::WORKER_PING => WorkerMessage::Response {
            id: request.id,
            ok: true,
            payload: Some(json!({ "pong": true, "worker": "plugin" })),
            error: None,
        },
        methods::WORKER_SHUTDOWN => WorkerMessage::Response {
            id: request.id,
            ok: true,
            payload: Some(json!({ "shutdown": true })),
            error: None,
        },
        methods::WORKER_HEALTH => WorkerMessage::Response {
            id: request.id,
            ok: true,
            payload: Some(crate::workers::worker_health_payload(
                "plugin",
                started_at_ms,
            )),
            error: None,
        },
        methods::PLUGIN_FETCH_CATALOG => response_from_result(request.id, || {
            let payload = serde_json::from_value::<FetchCatalogPayload>(request.payload)
                .map_err(|err| err.to_string())?;
            validate_http_url(&payload.url, "plugin catalog url")?;
            crate::plugins::fetch_plugin_catalog_backend(payload.url).map(|value| json!(value))
        }),
        methods::PLUGIN_READ_WASM_BYTES => response_from_result(request.id, || {
            let payload = serde_json::from_value::<ReadWasmPayload>(request.payload)
                .map_err(|err| err.to_string())?;
            validate_wasm_entry(&payload.entry)?;
            crate::plugins::read_plugin_wasm_bytes_backend(payload.entry).map(|value| json!(value))
        }),
        methods::PLUGIN_HTTP_REQUEST => response_from_result(request.id, || {
            let payload = serde_json::from_value::<HttpRequestPayload>(request.payload)
                .map_err(|err| err.to_string())?;
            validate_plugin_http_request(&payload)?;
            crate::plugins::plugin_http_request_backend(
                payload.method,
                payload.url,
                payload.headers,
                payload.data,
            )
            .map(|value| json!(value))
        }),
        methods::PLUGIN_INVOKE => response_from_result(request.id, || {
            let payload = serde_json::from_value::<InvokePayload>(request.payload)
                .map_err(|err| err.to_string())?;
            validate_plugin_invoke_entry(&payload.entry)?;
            invoke_plugin_backend(payload)
        }),
        method => WorkerMessage::Response {
            id: request.id,
            ok: false,
            payload: None,
            error: Some(format!("unsupported plugin worker method: {method}")),
        },
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FetchCatalogPayload {
    url: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReadWasmPayload {
    entry: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HttpRequestPayload {
    method: String,
    url: String,
    headers: Option<HashMap<String, String>>,
    data: Option<String>,
    plugin_id: Option<String>,
    permissions: Option<Vec<String>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InvokePayload {
    entry: String,
    request: Value,
    plugin_id: Option<String>,
    permissions: Option<Vec<String>>,
}

#[derive(Clone, Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct HostRequestPayload {
    method: Option<String>,
    url: Option<String>,
    headers: Option<HashMap<String, String>>,
    data: Option<String>,
    body: Option<String>,
}

fn invoke_plugin_backend(payload: InvokePayload) -> Result<Value, String> {
    log_plugin_args(
        "invoke_plugin_backend",
        json!({
            "entry": payload.entry,
            "request": payload.request,
            "pluginId": payload.plugin_id,
            "permissions": payload.permissions,
        }),
    );

    let wasm_bytes = crate::plugins::read_plugin_wasm_bytes_backend(payload.entry)?;
    let engine = Engine::default();
    let module = Module::from_binary(&engine, &wasm_bytes).map_err(|err| err.to_string())?;
    let mut store = Store::new(&engine, ());
    let instance = Instance::new(&mut store, &module, &[]).map_err(|err| err.to_string())?;
    let runtime = WasmPluginRuntime::new(&mut store, instance)?;
    let mut current_request = payload.request;

    for _ in 0..MAX_PLUGIN_HOST_REQUESTS {
        let response = match runtime.invoke(&mut store, &current_request) {
            Ok(response) => response,
            Err(error) => {
                if current_request.get("action").and_then(Value::as_str) == Some("play") {
                    log_plugin_args(
                        "invoke_plugin_backend::play invoke error",
                        json!({ "error": error }),
                    );
                }
                return Err(error);
            }
        };
        let Some(host_request_value) = response.get("hostRequest").cloned() else {
            if current_request.get("action").and_then(Value::as_str) == Some("play") {
                log_plugin_args(
                    "invoke_plugin_backend::play response",
                    json!({ "response": response.clone() }),
                );
            }
            return Ok(response);
        };

        let host_request = serde_json::from_value::<HostRequestPayload>(host_request_value.clone())
            .map_err(|err| err.to_string())?;
        let host_response = match execute_host_request(
            host_request.clone(),
            payload.plugin_id.clone(),
            payload.permissions.clone(),
        ) {
            Ok(response) => response,
            Err(error) => {
                if current_request.get("action").and_then(Value::as_str) == Some("play") {
                    log_plugin_args(
                        "invoke_plugin_backend::play host request error",
                        json!({
                            "hostRequest": host_request_value,
                            "error": error,
                        }),
                    );
                }
                return Err(error);
            }
        };

        current_request = json!({
            "action": "host_response",
            "request": current_request,
            "hostRequest": host_request,
            "response": host_response,
        });
    }

    Err("plugin exceeded the WASM host request limit.".to_string())
}

fn execute_host_request(
    host_request: HostRequestPayload,
    plugin_id: Option<String>,
    permissions: Option<Vec<String>>,
) -> Result<crate::plugins::PluginHttpResponse, String> {
    log_plugin_args(
        "execute_host_request",
        json!({
            "hostRequest": {
                "method": host_request.method,
                "url": host_request.url,
                "headers": host_request.headers,
                "data": host_request.data,
                "body": host_request.body,
            },
            "pluginId": plugin_id,
            "permissions": permissions,
        }),
    );
    let method = host_request.method.unwrap_or_else(|| "GET".to_string());
    let url = host_request
        .url
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "plugin host request missing url".to_string())?;
    let data = host_request.data.or(host_request.body);
    let payload = HttpRequestPayload {
        method: method.clone(),
        url: url.clone(),
        headers: host_request.headers.clone(),
        data: data.clone(),
        plugin_id: plugin_id.clone(),
        permissions,
    };
    validate_plugin_http_request(&payload)?;
    crate::plugins::plugin_http_request_backend(method, url, host_request.headers, data)
}

struct WasmPluginRuntime {
    instance: Instance,
    memory: Memory,
}

impl WasmPluginRuntime {
    fn new(store: &mut Store<()>, instance: Instance) -> Result<Self, String> {
        log_plugin_args("WasmPluginRuntime::new", json!({}));
        let memory = instance
            .get_memory(&mut *store, "memory")
            .ok_or_else(|| "plugin is missing required WASM export: memory".to_string())?;
        require_func(&mut *store, &instance, "mono_alloc")?;
        require_func(&mut *store, &instance, "mono_dealloc")?;
        require_func(&mut *store, &instance, "mono_invoke")?;
        require_func(&mut *store, &instance, "mono_last_len")?;
        Ok(Self { instance, memory })
    }

    fn invoke(&self, store: &mut Store<()>, request: &Value) -> Result<Value, String> {
        log_plugin_args("WasmPluginRuntime::invoke", json!({ "request": request }));
        let input = serde_json::to_vec(request).map_err(|err| err.to_string())?;
        if input.len() > MAX_PLUGIN_JSON_BYTES {
            return Err("plugin request JSON is too large".to_string());
        }

        let input_ptr = self.call_alloc(store, input.len())?;
        self.write_memory(store, input_ptr, &input)?;
        let output_ptr = match self.call_invoke(store, input_ptr, input.len()) {
            Ok(value) => value,
            Err(error) => {
                let _ = self.call_dealloc(store, input_ptr, input.len());
                return Err(error);
            }
        };
        self.call_dealloc(store, input_ptr, input.len())?;
        let output_len = self.call_last_len(store)?;
        if output_len == 0 {
            return Err("plugin returned an empty WASM response".to_string());
        }
        if output_len > MAX_PLUGIN_JSON_BYTES {
            let _ = self.call_dealloc(store, output_ptr, output_len);
            return Err("plugin response JSON is too large".to_string());
        }

        let output = self.read_memory(store, output_ptr, output_len)?;
        self.call_dealloc(store, output_ptr, output_len)?;
        serde_json::from_slice(&output).map_err(|err| err.to_string())
    }

    fn call_alloc(&self, store: &mut Store<()>, len: usize) -> Result<usize, String> {
        let len = i32::try_from(len).map_err(|_| "plugin allocation is too large".to_string())?;
        let alloc = self
            .instance
            .get_typed_func::<i32, i32>(&mut *store, "mono_alloc")
            .map_err(|err| err.to_string())?;
        let ptr = alloc.call(store, len).map_err(|err| err.to_string())?;
        usize::try_from(ptr)
            .map_err(|_| "plugin returned an invalid allocation pointer".to_string())
    }

    fn call_dealloc(&self, store: &mut Store<()>, ptr: usize, len: usize) -> Result<(), String> {
        let ptr = i32::try_from(ptr).map_err(|_| "plugin pointer is too large".to_string())?;
        let len = i32::try_from(len).map_err(|_| "plugin deallocation is too large".to_string())?;
        let dealloc = self
            .instance
            .get_typed_func::<(i32, i32), ()>(&mut *store, "mono_dealloc")
            .map_err(|err| err.to_string())?;
        dealloc
            .call(store, (ptr, len))
            .map_err(|err| err.to_string())
    }

    fn call_invoke(&self, store: &mut Store<()>, ptr: usize, len: usize) -> Result<usize, String> {
        let ptr = i32::try_from(ptr).map_err(|_| "plugin pointer is too large".to_string())?;
        let len = i32::try_from(len).map_err(|_| "plugin invoke input is too large".to_string())?;
        let invoke = self
            .instance
            .get_typed_func::<(i32, i32), i32>(&mut *store, "mono_invoke")
            .map_err(|err| err.to_string())?;
        let output_ptr = invoke
            .call(store, (ptr, len))
            .map_err(|err| err.to_string())?;
        usize::try_from(output_ptr)
            .map_err(|_| "plugin returned an invalid output pointer".to_string())
    }

    fn call_last_len(&self, store: &mut Store<()>) -> Result<usize, String> {
        let last_len = self
            .instance
            .get_typed_func::<(), i32>(&mut *store, "mono_last_len")
            .map_err(|err| err.to_string())?;
        let len = last_len.call(store, ()).map_err(|err| err.to_string())?;
        usize::try_from(len).map_err(|_| "plugin returned an invalid output length".to_string())
    }

    fn write_memory(&self, store: &mut Store<()>, ptr: usize, bytes: &[u8]) -> Result<(), String> {
        self.memory
            .write(store, ptr, bytes)
            .map_err(|err| err.to_string())
    }

    fn read_memory(
        &self,
        store: &mut Store<()>,
        ptr: usize,
        len: usize,
    ) -> Result<Vec<u8>, String> {
        let mut output = vec![0; len];
        self.memory
            .read(store, ptr, &mut output)
            .map_err(|err| err.to_string())?;
        Ok(output)
    }
}

fn require_func(store: &mut Store<()>, instance: &Instance, name: &str) -> Result<(), String> {
    instance
        .get_func(store, name)
        .ok_or_else(|| format!("plugin is missing required WASM export: {name}"))?;
    Ok(())
}

fn validate_plugin_http_request(payload: &HttpRequestPayload) -> Result<(), String> {
    let plugin_label = payload.plugin_id.as_deref().unwrap_or("unknown plugin");
    let has_network_permission = payload
        .permissions
        .as_ref()
        .map(|permissions| {
            permissions
                .iter()
                .any(|permission| permission == NETWORK_PERMISSION)
        })
        .unwrap_or(false);

    if !has_network_permission {
        return Err(format!(
            "{plugin_label} requested network access without network permission."
        ));
    }

    validate_http_url(&payload.url, "plugin request url")?;
    validate_http_method(&payload.method)?;
    validate_http_headers(payload.headers.as_ref())?;

    let method = payload.method.trim().to_ascii_uppercase();
    if matches!(method.as_str(), "GET" | "HEAD") && payload.data.is_some() {
        return Err(format!(
            "plugin HTTP {method} request cannot include a body"
        ));
    }

    Ok(())
}

fn validate_http_url(url: &str, label: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(url).map_err(|_| format!("{label} must be a valid url"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(format!("{label} must start with http:// or https://"));
    }
    if parsed.host_str().is_none() {
        return Err(format!("{label} must include a host"));
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(format!("{label} must not include credentials"));
    }
    Ok(())
}

fn validate_wasm_entry(entry: &str) -> Result<(), String> {
    if entry.starts_with("http://") || entry.starts_with("https://") {
        validate_http_url(entry, "plugin wasm entry")?;
        return Ok(());
    }

    if entry.contains("://") {
        return Err(
            "plugin wasm entry must use http://, https://, or a local .wasm file".to_string(),
        );
    }

    let path = Path::new(entry);
    let is_wasm = path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("wasm"))
        .unwrap_or(false);

    if !is_wasm {
        return Err("local plugin entry must be a .wasm file".to_string());
    }

    Ok(())
}

fn validate_plugin_invoke_entry(entry: &str) -> Result<(), String> {

    validate_wasm_entry(entry)
}

fn validate_http_method(method: &str) -> Result<(), String> {
    match method.trim().to_ascii_uppercase().as_str() {
        "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" => Ok(()),
        _ => Err("plugin HTTP method is not allowed".to_string()),
    }
}

fn validate_http_headers(headers: Option<&HashMap<String, String>>) -> Result<(), String> {
    let Some(headers) = headers else {
        return Ok(());
    };

    if headers.len() > MAX_PLUGIN_HEADER_COUNT {
        return Err(format!(
            "plugin HTTP request cannot include more than {MAX_PLUGIN_HEADER_COUNT} headers"
        ));
    }

    for (name, value) in headers {
        let name = name.trim();
        if name.is_empty() {
            return Err("plugin HTTP header name cannot be empty".to_string());
        }
        if is_forbidden_plugin_header(name) {
            return Err(format!("plugin HTTP header is not allowed: {name}"));
        }
        if value.len() > MAX_PLUGIN_HEADER_VALUE_BYTES {
            return Err(format!("plugin HTTP header value is too large: {name}"));
        }
        reqwest::header::HeaderName::from_bytes(name.as_bytes())
            .map_err(|_| format!("plugin HTTP header name is invalid: {name}"))?;
        reqwest::header::HeaderValue::from_str(value)
            .map_err(|_| format!("plugin HTTP header value is invalid: {name}"))?;
    }

    Ok(())
}

fn is_forbidden_plugin_header(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "connection"
            | "content-length"
            | "host"
            | "proxy-authenticate"
            | "proxy-authorization"
            | "te"
            | "trailer"
            | "transfer-encoding"
            | "upgrade"
    )
}

fn response_from_result<F>(id: String, action: F) -> WorkerMessage
where
    F: FnOnce() -> Result<Value, String>,
{
    match action() {
        Ok(payload) => WorkerMessage::Response {
            id,
            ok: true,
            payload: Some(payload),
            error: None,
        },
        Err(error) => WorkerMessage::Response {
            id,
            ok: false,
            payload: None,
            error: Some(error),
        },
    }
}

fn write_message<W: Write>(stdout: &mut W, message: &WorkerMessage) -> Result<(), String> {
    let encoded = encode_line(message)?;
    stdout
        .write_all(encoded.as_bytes())
        .and_then(|_| stdout.flush())
        .map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handles_ping_request() {
        let response = handle_request(
            WorkerRequest {
                id: "ping-1".to_string(),
                method: methods::WORKER_PING.to_string(),
                payload: json!({}),
            },
            1,
        );

        assert_eq!(
            response,
            WorkerMessage::Response {
                id: "ping-1".to_string(),
                ok: true,
                payload: Some(json!({ "pong": true, "worker": "plugin" })),
                error: None,
            }
        );
    }

    #[test]
    fn rejects_plugin_http_without_network_permission() {
        let response = handle_request(
            WorkerRequest {
                id: "http-1".to_string(),
                method: methods::PLUGIN_HTTP_REQUEST.to_string(),
                payload: json!({
                    "method": "GET",
                    "url": "https://example.com/catalog.json",
                    "headers": null,
                    "data": null,
                    "pluginId": "fixture-plugin",
                    "permissions": [],
                }),
            },
            1,
        );

        assert_eq!(
            response,
            WorkerMessage::Response {
                id: "http-1".to_string(),
                ok: false,
                payload: None,
                error: Some(
                    "fixture-plugin requested network access without network permission."
                        .to_string()
                ),
            }
        );
    }

    #[test]
    fn rejects_plugin_http_forbidden_header() {
        let response = handle_request(
            WorkerRequest {
                id: "http-2".to_string(),
                method: methods::PLUGIN_HTTP_REQUEST.to_string(),
                payload: json!({
                    "method": "GET",
                    "url": "https://example.com/catalog.json",
                    "headers": {
                        "Host": "example.org"
                    },
                    "data": null,
                    "pluginId": "fixture-plugin",
                    "permissions": ["network"],
                }),
            },
            1,
        );

        assert_eq!(
            response,
            WorkerMessage::Response {
                id: "http-2".to_string(),
                ok: false,
                payload: None,
                error: Some("plugin HTTP header is not allowed: Host".to_string()),
            }
        );
    }

    #[test]
    fn allows_accept_encoding_header_for_backend_filtering() {
        let payload = HttpRequestPayload {
            method: "GET".to_string(),
            url: "https://example.com/catalog.json".to_string(),
            headers: Some(HashMap::from([(
                "Accept-Encoding".to_string(),
                "gzip, deflate".to_string(),
            )])),
            data: None,
            plugin_id: Some("fixture-plugin".to_string()),
            permissions: Some(vec!["network".to_string()]),
        };

        assert!(validate_plugin_http_request(&payload).is_ok());
    }

    #[test]
    fn rejects_non_wasm_local_plugin_entry() {
        let response = handle_request(
            WorkerRequest {
                id: "wasm-1".to_string(),
                method: methods::PLUGIN_READ_WASM_BYTES.to_string(),
                payload: json!({ "entry": "D:\\plugins\\demo.txt" }),
            },
            1,
        );

        assert_eq!(
            response,
            WorkerMessage::Response {
                id: "wasm-1".to_string(),
                ok: false,
                payload: None,
                error: Some("local plugin entry must be a .wasm file".to_string()),
            }
        );
    }
}
