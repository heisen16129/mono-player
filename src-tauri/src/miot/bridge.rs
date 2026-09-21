use crate::{database, models::Track, state::AppState, store, workers::plugin::PluginWorkerState};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use tauri::{AppHandle, Emitter, Manager};

fn read(app: &AppHandle, key: &str, default: Value) -> Result<Value, String> {
    Ok(store::read_value(app, key)
        .map_err(|e| e.to_string())?
        .unwrap_or(default))
}
fn write(app: &AppHandle, key: &str, value: Value) -> Result<(), String> {
    let response = store::store_set(app.clone(), key.into(), value);
    if response.code != 1 {
        return Err(response.message);
    }
    let _ = app.emit("miot-library-changed", ());
    Ok(())
}
fn snapshot(app: &AppHandle) -> Result<Value, String> {
    let state = app.state::<AppState>();
    let tracks = database::read_tracks(&*state.db.lock().map_err(|e| e.to_string())?)?;
    let settings = read(app, "mono-player-settings", json!({}))?;
    let favorites = read(app, "mono-player-favorites", json!({"ids":[],"tracks":[]}))?;
    let favorites = if favorites.is_array() {
        json!({"ids":favorites,"tracks":[]})
    } else {
        favorites
    };
    let playlists = settings["playlists"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let remote = read(app, "miot.remote-tracks", json!([]))?;
    let mut all = BTreeMap::new();
    for value in favorites["tracks"]
        .as_array()
        .into_iter()
        .flatten()
        .chain(
            playlists
                .iter()
                .flat_map(|p| p["tracks"].as_array().into_iter().flatten()),
        )
        .chain(remote.as_array().into_iter().flatten())
    {
        if let Some(id) = value["id"].as_i64() {
            all.insert(id, value.clone());
        }
    }
    // Preserve the library order supplied by Mono, rather than BTreeMap's ID order.
    let mut ordered = Vec::with_capacity(tracks.len() + all.len());
    for track in tracks {
        all.remove(&track.id);
        ordered.push(json!(track));
    }
    ordered.extend(all.into_values());
    Ok(
        json!({"tracks":ordered,"favorites":favorites,"playlists":playlists}),
    )
}
fn track(app: &AppHandle, id: i64) -> Result<Value, String> {
    snapshot(app)?["tracks"]
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["id"] == id)
        .cloned()
        .ok_or("歌曲不存在".into())
}
fn plugins(app: &AppHandle) -> Result<Vec<Value>, String> {
    Ok(read(app, "plugins.installed", json!([]))?
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|p| {
            p["enabled"] == true
                && p["capabilities"].as_array().is_some_and(|c| {
                    c.iter().any(|v| v == "search") && c.iter().any(|v| v == "play")
                })
        })
        .collect())
}
fn plugin_call(app: &AppHandle, plugin: &Value, mut request: Value) -> Result<Value, String> {
    let id = plugin["id"].as_str().ok_or("缺少音源 ID")?;
    request["config"] = store::read_plugin_config_value(app, id)
        .map_err(|e| e.to_string())?
        .unwrap_or(json!({}));
    let response = app.state::<PluginWorkerState>().invoke_plugin(
        plugin["entry"].as_str().ok_or("缺少音源入口")?.into(),
        request,
        Some(id.into()),
        Some(serde_json::from_value(plugin["permissions"].clone()).map_err(|e| e.to_string())?),
    )?;
    if response["code"] != 1 {
        return Err(response["message"]
            .as_str()
            .unwrap_or("音源请求失败")
            .into());
    }
    Ok(response["data"].clone())
}
pub(crate) fn request(app: &AppHandle, method: &str, params: Value) -> Result<Value, String> {
    super::installed(app)?;
    match method {
        "snapshot" => snapshot(app),
        "plugins" => Ok(json!(plugins(app)?)),
        "search" => {
            let plugin = plugins(app)?
                .into_iter()
                .find(|p| p["id"] == params["providerId"])
                .ok_or("音源未启用")?;
            let mut data = plugin_call(
                app,
                &plugin,
                json!({"action":"search","keyword":params["keyword"],"page":1,"pageSize":params["pageSize"]}),
            )?;
            if let Some(tracks) = data["tracks"].as_array_mut() {
                for t in tracks {
                    t["providerId"] = plugin["id"].clone();
                    t["providerName"] = plugin["name"].clone();
                }
            }
            Ok(data)
        }
        "resolve" => {
            let track = track(app, params["id"].as_i64().ok_or("缺少歌曲 ID")?)?;
            if let Some(provider) = track["sourceProviderId"].as_str().filter(|s| !s.is_empty()) {
                let plugin = plugins(app)?
                    .into_iter()
                    .find(|p| p["id"] == provider)
                    .ok_or("歌曲音源已停用")?;
                let source = plugin_call(
                    app,
                    &plugin,
                    json!({"action":"play","track":track["sourceRaw"],"includeMetadata":false}),
                )?;
                let url = source["url"].as_str().ok_or("音源没有返回播放地址")?;
                if !url.starts_with("http://") && !url.starts_with("https://") {
                    return Err("不支持的音源地址".into());
                }
                Ok(json!(url))
            } else {
                Ok(track["path"].clone())
            }
        }
        "track_details" => {
            let mut song = track(app, params["id"].as_i64().ok_or("缺少歌曲 ID")?)?;
            song["lyrics"] = lyrics_for_track(app, &song).unwrap_or(Value::Null);
            let path = std::path::Path::new(song["path"].as_str().unwrap_or(""));
            if song["associatedArtwork"]
                .as_str()
                .is_some_and(|s| !s.is_empty())
            {
                song["artwork"] = song["associatedArtwork"].clone();
            } else if path.is_file() {
                let root = app.state::<crate::player::PlayerState>().cache_dir()?;
                if let Some(files) = crate::covers::cached_cover_files_in(&root, path)? {
                    song["artwork"] = json!(files.original_url);
                }
            }
            Ok(song)
        }
        "cover" => {
            let song = track(app, params["id"].as_i64().ok_or("缺少歌曲 ID")?)?;
            for field in ["associatedArtwork", "artwork"] {
                if let Some(source) = song[field].as_str().filter(|v| !v.is_empty()) {
                    if source.starts_with("https://") || source.starts_with("http://") {
                        return Ok(json!(source));
                    }
                    let path = if source.starts_with("file:") {
                        tauri::Url::parse(source)
                            .ok()
                            .and_then(|u| u.to_file_path().ok())
                    } else {
                        Some(std::path::PathBuf::from(source))
                    };
                    if let Some(path) = path.filter(|p| p.is_file()) {
                        return Ok(json!(path.to_string_lossy()));
                    }
                }
            }
            let path = std::path::Path::new(song["path"].as_str().unwrap_or(""));
            if path.is_file() {
                let root = app.state::<crate::player::PlayerState>().cache_dir()?;
                return Ok(crate::covers::cached_cover_files_in(&root, path)?
                    .map(|files| json!(files.thumbnail_url))
                    .unwrap_or(Value::Null));
            }
            Ok(Value::Null)
        }
        "lyrics" => {
            let track = track(app, params["id"].as_i64().ok_or("缺少歌曲 ID")?)?;
            let bundle = lyrics_for_track(app, &track)?;
            let content = bundle["lyrics"]
                .as_array()
                .and_then(|a| a.first())
                .and_then(|v| v["content"].as_str())
                .unwrap_or("");
            Ok(json!({"lyric":content}))
        }
        "import_remote" => {
            let items = params.as_array().ok_or("歌曲列表格式无效")?;
            let mut saved = read(app, "miot.remote-tracks", json!([]))?
                .as_array()
                .cloned()
                .unwrap_or_default();
            let mut imported = Vec::new();
            for item in items {
                let source: Value =
                    serde_json::from_str(item["source_data"].as_str().unwrap_or("{}"))
                        .map_err(|e| e.to_string())?;
                let provider = item["plugin_entry_path"].as_str().unwrap_or("");
                let key = format!(
                    "{}:{}",
                    provider,
                    item["dedup_key"]
                        .as_str()
                        .unwrap_or(item["url"].as_str().unwrap_or(""))
                );
                if let Some(existing) = saved.iter().find(|t| t["miotKey"] == key) {
                    imported.push(existing.clone());
                    continue;
                }
                let id = -(chrono::Utc::now().timestamp_millis() * 100 + imported.len() as i64);
                let value = json!({"id":id,"path":item["url"],"title":item["title"],"artist":[item["artist"]],"album":item["album"],"duration":item["duration"],
                    "artwork":item["cover_url"],"sourceProviderId":if provider.is_empty() { Value::Null } else { json!(provider) },
                    "sourceId":item["dedup_key"],"sourceRaw":source,"miotKey":key,
                    "lyrics":item["lyric"].as_str().filter(|s| !s.is_empty()).map(|s| json!({"lyrics":[{"format":"lrc","content":s}]}))});
                saved.push(value.clone());
                imported.push(value);
            }
            write(app, "miot.remote-tracks", json!(saved))?;
            Ok(json!(imported))
        }
        "playlist_edit" => {
            let ids = params["ids"].as_array().ok_or("缺少歌曲列表")?;
            let add = params["add"] == true;
            let key = if params["id"] == "__favorites" {
                "mono-player-favorites"
            } else {
                "mono-player-settings"
            };
            let mut value = read(app, key, json!({}))?;
            if value.is_array() {
                value = json!({"ids":value,"tracks":[]});
            }
            let container = if key == "mono-player-favorites" {
                &mut value
            } else {
                value["playlists"]
                    .as_array_mut()
                    .and_then(|ps| ps.iter_mut().find(|p| p["id"] == params["id"]))
                    .ok_or("歌单不存在或不可编辑")?
            };
            let field = if key == "mono-player-favorites" {
                "ids"
            } else {
                "trackIds"
            };
            let mut current = container[field].as_array().cloned().unwrap_or_default();
            current.retain(|id| !ids.contains(id));
            let mut snapshots = container["tracks"].as_array().cloned().unwrap_or_default();
            snapshots.retain(|t| !ids.contains(&t["id"]));
            if add {
                for id in ids {
                    let t = track(app, id.as_i64().ok_or("无效歌曲 ID")?)?;
                    current.push(id.clone());
                    snapshots.push(t);
                }
            }
            container[field] = json!(current);
            container["tracks"] = json!(snapshots);
            write(app, key, value)?;
            Ok(json!({}))
        }
        "delete_song" => {
            // This operation removes library records only; it never deletes source audio.
            let id = params["id"].as_i64().ok_or("缺少歌曲 ID")?;
            let state = app.state::<AppState>();
            state
                .db
                .lock()
                .map_err(|e| e.to_string())?
                .execute("DELETE FROM tracks WHERE id = ?1", [id])
                .map_err(|e| e.to_string())?;
            let mut remote = read(app, "miot.remote-tracks", json!([]))?
                .as_array()
                .cloned()
                .unwrap_or_default();
            remote.retain(|t| t["id"] != id);
            write(app, "miot.remote-tracks", json!(remote))?;
            let mut favorites = read(app, "mono-player-favorites", json!({}))?;
            if let Some(ids) = favorites.as_array_mut() {
                ids.retain(|v| v != id);
            } else {
                remove_song_reference(&mut favorites, "ids", id);
            }
            write(app, "mono-player-favorites", favorites)?;
            let mut settings = read(app, "mono-player-settings", json!({}))?;
            if let Some(lists) = settings["playlists"].as_array_mut() {
                for list in lists {
                    remove_song_reference(list, "trackIds", id);
                }
            }
            write(app, "mono-player-settings", settings)?;
            Ok(json!({}))
        }
        "played" => {
            let mut ids = read(app, "mono-player-recent-played-track-ids", json!([]))?
                .as_array()
                .cloned()
                .unwrap_or_default();
            ids.retain(|id| id != &params["id"]);
            ids.insert(0, params["id"].clone());
            ids.truncate(200);
            write(app, "mono-player-recent-played-track-ids", json!(ids))?;
            Ok(json!({}))
        }
        _ => Err("不支持的音箱宿主请求".into()),
    }
}

fn remove_song_reference(container: &mut Value, field: &str, id: i64) {
    if let Some(ids) = container[field].as_array_mut() {
        ids.retain(|v| v != id);
    }
    if let Some(tracks) = container["tracks"].as_array_mut() {
        tracks.retain(|v| v["id"] != id);
    }
}

fn lyrics_for_track(app: &AppHandle, track: &Value) -> Result<Value, String> {
    let mut bundle = track["associatedLyrics"].clone();
    if bundle.is_null() {
        bundle = track["lyrics"].clone();
    }
    if bundle.is_null() {
        let model: Track = serde_json::from_value(track.clone()).map_err(|e| e.to_string())?;
        if model.source_provider_id.is_none() {
            bundle = json!(crate::lyrics::read_local_lyrics_bundle_for_track(
                &model.path,
                Some(&model.title),
                model.artist.as_deref()
            )?);
        } else if let Some(plugin) = plugins(app)?
            .into_iter()
            .find(|p| p["id"] == track["sourceProviderId"])
        {
            bundle = plugin_call(
                app,
                &plugin,
                json!({"action":"lyrics","track":track["sourceRaw"]}),
            )?;
        }
    }
    Ok(bundle)
}
