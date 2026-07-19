use crate::mcp_bridge::{self, BridgeRequest};
use serde_json::{json, Value};
use std::{
    env,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    path::PathBuf,
    thread,
    time::Duration,
};

const DEFAULT_PROTOCOL_VERSION: &str = "2024-11-05";
const SERVER_NAME: &str = "mono-player";
const SERVER_VERSION: &str = "0.1.0";
const APP_IDENTIFIER: &str = "com.local.mono-player";
const MCP_HTTP_PATH: &str = "/mcp";
const MCP_HEALTH_PATH: &str = "/health";
const MCP_HTTP_TOKEN_HEADER: &str = "x-mono-mcp-token";

pub fn run_http(args: Vec<String>) -> Result<(), String> {
    let config = resolve_http_config(&args)?;
    let listener =
        TcpListener::bind((config.host.as_str(), config.port)).map_err(|err| err.to_string())?;
    let local_addr = listener.local_addr().map_err(|err| err.to_string())?;
    eprintln!(
        "Mono MCP HTTP server listening on http://{}{}",
        local_addr, MCP_HTTP_PATH
    );

    serve_http(listener, config.bridge_file, config.token);
    Ok(())
}

fn serve_http(listener: TcpListener, bridge_file: PathBuf, token: Option<String>) {
    for stream in listener.incoming() {
        let Ok(stream) = stream else {
            continue;
        };
        let bridge_file = bridge_file.clone();
        let token = token.clone();
        thread::spawn(move || {
            let _ = handle_http_stream(stream, bridge_file, token.as_deref());
        });
    }
}

fn handle_line(line: &str, bridge_file: &PathBuf) -> Option<Value> {
    let request = match serde_json::from_str::<Value>(line) {
        Ok(value) => value,
        Err(err) => {
            return Some(error_response(
                Value::Null,
                -32700,
                format!("Parse error: {err}"),
            ));
        }
    };

    let id = request.get("id").cloned();
    let method = request.get("method").and_then(Value::as_str);
    let params = request.get("params").cloned().unwrap_or_else(|| json!({}));

    let Some(method) = method else {
        return id.map(|id| error_response(id, -32600, "Invalid request".to_string()));
    };

    let Some(id) = id else {
        log_mcp_notification(Some(method), &params);
        return None;
    };

    log_mcp_request(method, &id, &params);
    let result = match method {
        "initialize" => Ok(initialize_result(params)),
        "tools/list" => Ok(tools_list_result()),
        "tools/call" => call_tool(params, bridge_file),
        "resources/list" => list_resources(bridge_file),
        "resources/read" => read_resource(params, bridge_file),
        _ => Err((-32601, format!("Method not found: {method}"))),
    };

    Some(match result {
        Ok(result) => {
            log_mcp_result(method, &id, true, None);
            success_response(id, result)
        }
        Err((code, message)) => {
            log_mcp_result(method, &id, false, Some(&message));
            error_response(id, code, message)
        }
    })
}

fn initialize_result(params: Value) -> Value {
    let protocol_version = params
        .get("protocolVersion")
        .and_then(Value::as_str)
        .unwrap_or(DEFAULT_PROTOCOL_VERSION);

    json!({
        "protocolVersion": protocol_version,
        "capabilities": {
            "tools": {},
            "resources": {}
        },
        "serverInfo": {
            "name": SERVER_NAME,
            "version": SERVER_VERSION
        }
    })
}

fn log_mcp_notification(method: Option<&str>, params: &Value) {
    eprintln!(
        "[mcp:http] notification method={} params={}",
        method.unwrap_or("<missing>"),
        compact_json(params)
    );
}

fn log_mcp_request(method: &str, id: &Value, params: &Value) {
    let detail = match method {
        "tools/call" => params
            .get("name")
            .and_then(Value::as_str)
            .map(|name| format!(" tool={name}"))
            .unwrap_or_default(),
        "resources/read" => params
            .get("uri")
            .and_then(Value::as_str)
            .map(|uri| format!(" uri={uri}"))
            .unwrap_or_default(),
        _ => String::new(),
    };
    eprintln!(
        "[mcp:http] request id={} method={method}{detail} params={}",
        id,
        compact_json(params)
    );
}

fn log_mcp_result(method: &str, id: &Value, ok: bool, error: Option<&str>) {
    match error {
        Some(error) => eprintln!(
            "[mcp:http] response id={} method={method} ok={ok} error={error}",
            id
        ),
        None => eprintln!("[mcp:http] response id={} method={method} ok={ok}", id),
    }
}

fn compact_json(value: &Value) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "<invalid-json>".to_string())
}

fn tools_list_result() -> Value {
    json!({
        "tools": [
            {
                "name": "mono_library_summary",
                "description": "通过正在运行的 Mono Player 主进程返回本地曲库曲目数量。",
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": false
                }
            },
            {
                "name": "mono_list_tracks",
                "description": "通过正在运行的 Mono Player 主进程按关键词和数量限制读取曲库曲目。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "可选关键词，会匹配标题、艺术家、专辑和文件路径。"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "最多返回多少首，默认 50，最大 200。"
                        }
                    },
                    "additionalProperties": false
                }
            },
            {
                "name": "mono_get_track",
                "description": "通过正在运行的 Mono Player 主进程按曲目 ID 读取单曲。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "integer",
                            "description": "曲目 ID。"
                        }
                    },
                    "required": ["id"],
                    "additionalProperties": false
                }
            },
            {
                "name": "mono_list_artists",
                "description": "列出曲库里的所有歌手，并统计每个歌手的曲目数量。",
                "inputSchema": empty_schema()
            },
            {
                "name": "mono_list_albums",
                "description": "列出曲库里的所有专辑，并统计每张专辑的曲目数量。",
                "inputSchema": empty_schema()
            },
            {
                "name": "mono_list_playlists",
                "description": "列出用户创建的歌单。",
                "inputSchema": empty_schema()
            },
            {
                "name": "mono_get_playlist",
                "description": "按歌单 ID 查看歌单里的歌曲。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "歌单 ID。"
                        }
                    },
                    "required": ["id"],
                    "additionalProperties": false
                }
            },
            {
                "name": "mono_player_state",
                "description": "查看当前播放状态、进度、音量、倍速和缓冲状态。",
                "inputSchema": empty_schema()
            },
            {
                "name": "mono_current_music_state",
                "description": "查看当前音乐摘要，包括歌名、歌手、专辑、播放进度、总时长、音量和是否正在播放。",
                "inputSchema": empty_schema()
            },
            {
                "name": "mono_queue_snapshot",
                "description": "查看当前播放队列、当前曲目索引和播放模式。",
                "inputSchema": empty_schema()
            },
            {
                "name": "mono_play_track",
                "description": "按曲库 track id 播放某首歌。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "integer",
                            "description": "曲目 ID。"
                        }
                    },
                    "required": ["id"],
                    "additionalProperties": false
                }
            },
            {
                "name": "mono_pause",
                "description": "暂停播放。",
                "inputSchema": empty_schema()
            },
            {
                "name": "mono_resume",
                "description": "继续播放当前曲目。",
                "inputSchema": empty_schema()
            },
            {
                "name": "mono_stop",
                "description": "停止播放。",
                "inputSchema": empty_schema()
            },
            {
                "name": "mono_next",
                "description": "播放队列中的下一首。",
                "inputSchema": empty_schema()
            },
            {
                "name": "mono_previous",
                "description": "播放队列中的上一首。",
                "inputSchema": empty_schema()
            },
            {
                "name": "mono_seek",
                "description": "跳转到指定播放位置，单位为秒。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "seconds": {
                            "type": "number",
                            "description": "目标播放位置，单位秒。"
                        }
                    },
                    "required": ["seconds"],
                    "additionalProperties": false
                }
            },
            {
                "name": "mono_set_volume",
                "description": "设置播放器音量，范围 0 到 1。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "volume": {
                            "type": "number",
                            "description": "目标音量，0 为静音，1 为最大音量。"
                        }
                    },
                    "required": ["volume"],
                    "additionalProperties": false
                }
            },
            {
                "name": "mono_set_sleep_timer",
                "description": "设置定时关闭。到时间后可停止播放、退出应用，或播完当前歌曲后停止。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "minutes": {
                            "type": "integer",
                            "description": "定时分钟数，范围 1 到 999。"
                        },
                        "action": {
                            "type": "string",
                            "enum": ["stop", "exit", "finishTrack"],
                            "description": "到时间后的动作。stop=停止播放，exit=退出应用，finishTrack=播完当前歌曲后停止。不传则沿用播放器当前设置。"
                        }
                    },
                    "required": ["minutes"],
                    "additionalProperties": false
                }
            },
            {
                "name": "mono_scan_folder",
                "description": "扫描指定本地音乐目录，写入曲库，并删除该目录下已不存在的旧曲目。需要传入明确目录路径。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "要扫描的本地音乐文件夹路径。"
                        }
                    },
                    "required": ["path"],
                    "additionalProperties": false
                }
            },
            {
                "name": "mono_search_online_music",
                "description": "通过已安装并启用的 Rust 插件 worker 搜索在线音乐。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "keyword": {
                            "type": "string",
                            "description": "搜索关键词。"
                        },
                        "providerId": {
                            "type": "string",
                            "description": "可选插件 ID。"
                        },
                        "page": {
                            "type": "integer",
                            "description": "页码，默认 1。"
                        },
                        "pageSize": {
                            "type": "integer",
                            "description": "返回数量，默认 30，最大 100。"
                        }
                    },
                    "required": ["keyword"],
                    "additionalProperties": false
                }
            },
            {
                "name": "mono_play_online_music",
                "description": "播放在线音乐。传入在线搜索返回的 track/source 对象，统一交给 Rust 播放队列解析；不支持直接传 URL。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "track": {
                            "type": "object",
                            "description": "在线搜索返回的 track 对象。"
                        },
                        "source": {
                            "type": "object",
                            "description": "在线搜索返回的 source/track 对象。"
                        }
                    },
                    "additionalProperties": true
                }
            },
            {
                "name": "mono_get_lyrics",
                "description": "获取歌词。支持传入 rawLyrics/lyrics，或按本地曲库 id/path 读取本地歌词文件。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "integer",
                            "description": "本地曲库曲目 ID。"
                        },
                        "path": {
                            "type": "string",
                            "description": "本地音频路径。"
                        },
                        "rawLyrics": {
                            "type": "string",
                            "description": "已获得的原始歌词。"
                        },
                        "year": {
                            "type": "integer",
                            "description": "可选发行年份。"
                        },
                        "genre": {
                            "type": "string",
                            "description": "可选流派。"
                        },
                        "trackNumber": {
                            "type": "integer",
                            "description": "可选音轨号。"
                        },
                        "lyrics": {
                            "type": "string",
                            "description": "已获得的歌词。"
                        }
                    },
                    "additionalProperties": true
                }
            },
            {
                "name": "mono_get_cover",
                "description": "获取封面。支持传入 artwork URL，或按本地曲库 id/path 读取本地封面。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "integer",
                            "description": "本地曲库曲目 ID。"
                        },
                        "path": {
                            "type": "string",
                            "description": "本地音频路径。"
                        },
                        "artwork": {
                            "type": "string",
                            "description": "已获得的封面 URL。"
                        }
                    },
                    "additionalProperties": true
                }
            },
            {
                "name": "mono_download_track",
                "description": "把在线 Track 下载到本地，默认进入下载队列。本地曲库歌曲已经在本地，无需下载。",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "track": {
                            "type": "object",
                            "description": "在线 Track 对象。path 可为真实 HTTP/HTTPS 地址或 plugin:// 来源；plugin:// Track 应包含 sourceProviderId/sourceRaw 以便后端解析播放源和歌词。"
                        },
                        "taskId": {
                            "type": "string",
                            "description": "可选下载任务 ID。"
                        },
                        "downloadDir": {
                            "type": "string",
                            "description": "可选下载目录；不传时使用 Mono Player 设置中的下载目录。"
                        },
                        "qualityFallback": {
                            "type": "string",
                            "description": "可选插件播放源兜底音质。"
                        }
                    },
                    "required": ["track"],
                    "additionalProperties": false
                }
            }
        ]
    })
}

fn empty_schema() -> Value {
    json!({
        "type": "object",
        "properties": {},
        "additionalProperties": false
    })
}

fn call_tool(params: Value, bridge_file: &PathBuf) -> Result<Value, (i32, String)> {
    let name = params
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| (-32602, "tools/call requires params.name".to_string()))?;
    let arguments = params
        .get("arguments")
        .cloned()
        .unwrap_or_else(|| json!({}));

    let method = match name {
        "mono_library_summary" => "library.summary",
        "mono_list_tracks" => "library.listTracks",
        "mono_get_track" => "library.getTrack",
        "mono_list_artists" => "library.listArtists",
        "mono_list_albums" => "library.listAlbums",
        "mono_list_playlists" => "playlist.list",
        "mono_get_playlist" => "playlist.get",
        "mono_player_state" => "player.state",
        "mono_current_music_state" => "player.currentMusicState",
        "mono_queue_snapshot" => "player.queueSnapshot",
        "mono_play_track" => "player.playTrack",
        "mono_pause" => "player.pause",
        "mono_resume" => "player.resume",
        "mono_stop" => "player.stop",
        "mono_next" => "player.next",
        "mono_previous" => "player.previous",
        "mono_seek" => "player.seek",
        "mono_set_volume" => "player.setVolume",
        "mono_set_sleep_timer" => "player.setSleepTimer",
        "mono_scan_folder" => "scanner.scanFolder",
        "mono_search_online_music" => "online.searchMusic",
        "mono_play_online_music" => "online.playMusic",
        "mono_get_lyrics" => "online.getLyrics",
        "mono_get_cover" => "online.getCover",
        "mono_download_track" => "online.downloadTrack",
        _ => return Err((-32602, format!("Unknown tool: {name}"))),
    };

    let info = mcp_bridge::read_bridge_info(bridge_file).map_err(|err| (-32000, err))?;
    let payload = mcp_bridge::request(
        &info,
        BridgeRequest {
            method: method.to_string(),
            params: arguments,
        },
    )
    .map_err(|err| (-32000, err))?;

    Ok(json!({
        "content": [
            {
                "type": "text",
                "text": serde_json::to_string_pretty(&payload).map_err(|err| (-32603, err.to_string()))?
            }
        ]
    }))
}

fn list_resources(bridge_file: &PathBuf) -> Result<Value, (i32, String)> {
    bridge_request("resource.list", json!({}), bridge_file)
}

fn read_resource(params: Value, bridge_file: &PathBuf) -> Result<Value, (i32, String)> {
    let uri = params
        .get("uri")
        .and_then(Value::as_str)
        .ok_or_else(|| (-32602, "resources/read requires params.uri".to_string()))?;
    bridge_request("resource.read", json!({ "uri": uri }), bridge_file)
}

fn bridge_request(
    method: &str,
    params: Value,
    bridge_file: &PathBuf,
) -> Result<Value, (i32, String)> {
    let info = mcp_bridge::read_bridge_info(bridge_file).map_err(|err| (-32000, err))?;
    mcp_bridge::request(
        &info,
        BridgeRequest {
            method: method.to_string(),
            params,
        },
    )
    .map_err(|err| (-32000, err))
}

struct McpHttpConfig {
    host: String,
    port: u16,
    token: Option<String>,
    bridge_file: PathBuf,
}

fn resolve_http_config(args: &[String]) -> Result<McpHttpConfig, String> {
    let host = string_arg(args, "--host").unwrap_or_else(|| "127.0.0.1".to_string());
    let port = string_arg(args, "--port")
        .map(|value| {
            value
                .parse::<u16>()
                .map_err(|err| format!("--port must be a valid TCP port: {err}"))
        })
        .transpose()?
        .unwrap_or(17331);
    let token = string_arg(args, "--token").filter(|value| !value.is_empty());
    if host != "127.0.0.1" && host != "localhost" && token.is_none() {
        return Err(
            "--token is required when MCP HTTP server listens outside localhost.".to_string(),
        );
    }

    Ok(McpHttpConfig {
        host,
        port,
        token,
        bridge_file: resolve_bridge_file_path(args)?,
    })
}

fn handle_http_stream(
    mut stream: TcpStream,
    bridge_file: PathBuf,
    token: Option<&str>,
) -> Result<(), String> {
    stream
        .set_read_timeout(Some(Duration::from_secs(30)))
        .map_err(|err| err.to_string())?;
    let raw_request = read_http_request(&mut stream)?;
    let response = handle_http_request(&raw_request, &bridge_file, token);
    write_http_response(&mut stream, response)
}

fn handle_http_request(
    raw_request: &str,
    bridge_file: &PathBuf,
    token: Option<&str>,
) -> HttpResponse {
    let Some((head, body)) = raw_request.split_once("\r\n\r\n") else {
        return HttpResponse::json(
            400,
            error_response(Value::Null, -32700, "Invalid HTTP request".to_string()),
        );
    };
    let mut lines = head.lines();
    let request_line = lines.next().unwrap_or_default();
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or_default();
    let path = parts.next().unwrap_or_default();
    let headers = lines.collect::<Vec<_>>();

    if method == "GET" && path == MCP_HEALTH_PATH {
        return HttpResponse::json(
            200,
            json!({
                "ok": true,
                "server": SERVER_NAME,
                "transport": "http"
            }),
        );
    }

    if method != "POST" || path != MCP_HTTP_PATH {
        return HttpResponse::json(404, json!({ "error": "Not found" }));
    }
    if !http_authorized(&headers, token) {
        return HttpResponse::json(401, json!({ "error": "Unauthorized" }));
    }

    match handle_line(body.trim(), bridge_file) {
        Some(response) => HttpResponse::json(200, response),
        None => HttpResponse::json(202, json!({})),
    }
}

fn http_authorized(headers: &[&str], token: Option<&str>) -> bool {
    let Some(token) = token else {
        return true;
    };
    headers.iter().any(|line| {
        line.split_once(':')
            .map(|(name, value)| {
                let name = name.trim();
                let value = value.trim();
                (name.eq_ignore_ascii_case(MCP_HTTP_TOKEN_HEADER) && value == token)
                    || (name.eq_ignore_ascii_case("authorization")
                        && value.strip_prefix("Bearer ") == Some(token))
            })
            .unwrap_or(false)
    })
}

struct HttpResponse {
    status: u16,
    body: String,
}

impl HttpResponse {
    fn json(status: u16, value: Value) -> Self {
        Self {
            status,
            body: serde_json::to_string(&value).unwrap_or_else(|_| "{}".to_string()),
        }
    }
}

fn read_http_request(stream: &mut TcpStream) -> Result<String, String> {
    let mut buffer = Vec::new();
    let mut chunk = [0; 1024];
    let header_end;

    loop {
        let bytes_read = stream.read(&mut chunk).map_err(|err| err.to_string())?;
        if bytes_read == 0 {
            return Err("HTTP client closed connection".to_string());
        }
        buffer.extend_from_slice(&chunk[..bytes_read]);
        if let Some(index) = find_header_end(&buffer) {
            header_end = index;
            break;
        }
    }

    let head = String::from_utf8_lossy(&buffer[..header_end]).to_string();
    let content_length = content_length(&head)?;
    let body_start = header_end + 4;
    while buffer.len().saturating_sub(body_start) < content_length {
        let bytes_read = stream.read(&mut chunk).map_err(|err| err.to_string())?;
        if bytes_read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..bytes_read]);
    }

    String::from_utf8(buffer).map_err(|err| err.to_string())
}

fn write_http_response(stream: &mut TcpStream, response: HttpResponse) -> Result<(), String> {
    let status = match response.status {
        200 => "200 OK",
        202 => "202 Accepted",
        400 => "400 Bad Request",
        401 => "401 Unauthorized",
        404 => "404 Not Found",
        _ => "500 Internal Server Error",
    };
    let head = format!(
        "HTTP/1.1 {status}\r\ncontent-type: application/json\r\ncontent-length: {}\r\naccess-control-allow-origin: *\r\nconnection: close\r\n\r\n",
        response.body.len()
    );
    stream
        .write_all(head.as_bytes())
        .and_then(|_| stream.write_all(response.body.as_bytes()))
        .and_then(|_| stream.flush())
        .map_err(|err| err.to_string())
}

fn find_header_end(buffer: &[u8]) -> Option<usize> {
    buffer.windows(4).position(|window| window == b"\r\n\r\n")
}

fn content_length(head: &str) -> Result<usize, String> {
    head.lines()
        .find_map(|line| {
            line.split_once(':').and_then(|(name, value)| {
                name.trim()
                    .eq_ignore_ascii_case("content-length")
                    .then(|| value.trim().parse::<usize>())
            })
        })
        .transpose()
        .map_err(|err| err.to_string())
        .map(|value| value.unwrap_or(0))
}

fn resolve_bridge_file_path(args: &[String]) -> Result<PathBuf, String> {
    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--bridge" => {
                let path = args
                    .get(index + 1)
                    .ok_or_else(|| "--bridge requires a path".to_string())?;
                return Ok(PathBuf::from(path));
            }
            value if value.starts_with("--bridge=") => {
                return Ok(PathBuf::from(value.trim_start_matches("--bridge=")));
            }
            _ => index += 1,
        }
    }

    Ok(mcp_bridge::bridge_file_path(&default_app_data_dir()))
}

fn string_arg(args: &[String], name: &str) -> Option<String> {
    let mut index = 0;
    while index < args.len() {
        let value = &args[index];
        if value == name {
            return args.get(index + 1).cloned();
        }
        if let Some(value) = value.strip_prefix(&format!("{name}=")) {
            return Some(value.to_string());
        }
        index += 1;
    }
    None
}

fn default_app_data_dir() -> PathBuf {
    if cfg!(target_os = "windows") {
        env::var_os("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
            .join(APP_IDENTIFIER)
    } else if cfg!(target_os = "macos") {
        env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
            .join("Library")
            .join("Application Support")
            .join(APP_IDENTIFIER)
    } else {
        env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share")))
            .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
            .join(APP_IDENTIFIER)
    }
}

fn success_response(id: Value, result: Value) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": result
    })
}

fn error_response(id: Value, code: i32, message: String) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": {
            "code": code,
            "message": message
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn notification_returns_no_response() {
        let response = handle_line(
            r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#,
            &PathBuf::from("unused.json"),
        );

        assert!(response.is_none());
    }

    #[test]
    fn lists_mcp_tools() {
        let response = handle_line(
            r#"{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}"#,
            &PathBuf::from("unused.json"),
        )
        .expect("tools/list should respond");

        assert_eq!(response["jsonrpc"], "2.0");
        assert_eq!(
            response["result"]["tools"][0]["name"],
            "mono_library_summary"
        );
    }
}
