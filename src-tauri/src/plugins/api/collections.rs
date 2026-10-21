use super::library::{list_tracks, ordered_tracks, paginate, resolve, track_id};
use crate::{database::{favorites, playlists}, models::plugin_api::{Error, Result}, state::AppState};
use serde::{de::DeserializeOwned, Deserialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};

fn parse<T: DeserializeOwned>(params: &Value) -> Result<T> {
    serde_json::from_value(params.clone()).map_err(|_| Error::new("INVALID_ARGUMENT", "Invalid collection parameters"))
}
fn internal(_: String) -> Error { Error::new("INTERNAL", "Collection operation failed") }

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TrackId { track_id: String }

pub(super) fn dispatch(app: &AppHandle, method: &str, params: &Value) -> Result<Value> {
    let queued = if matches!(method, "playlists.create" | "favorites.set" | "playlists.addTracks" | "playlists.removeTracks") {
        crate::player::plugin_queue::view(app).map_err(|_| Error::new("INTERNAL", "Cannot read queue"))?.tracks
    } else { Vec::new() };
    let state = app.state::<AppState>();
    let mut db = state.db.lock().map_err(|_| Error::new("INTERNAL", "Cannot read collections"))?;
    let (result, changed) = execute_with_tracks(&mut db, method, params, &queued)?;
    drop(db);
    if let Some(event) = changed { let _ = app.emit(event, ()); }
    Ok(result)
}

fn resolve_known(db: &rusqlite::Connection, id: &str, queued: &[crate::models::Track]) -> Result<crate::models::Track> {
    match resolve(db, id) {
        Err(error) if error.code == "NOT_FOUND" => queued.iter().find(|track| track_id(track) == id).cloned().ok_or(error),
        result => result,
    }
}

fn execute_with_tracks(db: &mut rusqlite::Connection, method: &str, params: &Value, queued: &[crate::models::Track]) -> Result<(Value, Option<&'static str>)> {
    let mut changed = None;
    let result = match method {
        "favorites.list" => {
            let tracks: Vec<_> = favorites::read_favorites(&db).map_err(internal)?.into_iter().map(|f| f.track).collect();
            list_tracks(&tracks, params)?
        }
        "favorites.contains" => {
            let input: TrackId = parse(params)?;
            json!(favorites::read_favorites(&db).map_err(internal)?.iter().any(|f| track_id(&f.track) == input.track_id))
        }
        "favorites.set" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase", deny_unknown_fields)]
            struct Set { track_id: String, favorite: bool }
            let input: Set = parse(params)?;
            let track = resolve_known(&db, &input.track_id, queued)?;
            if input.favorite { favorites::insert_favorite(&db, &track).map_err(internal)?; }
            else if let Some(entry) = favorites::read_favorites(&db).map_err(internal)?.iter().find(|f| track_id(&f.track) == input.track_id) {
                favorites::delete_favorite(&db, entry.id).map_err(internal)?;
            }
            changed = Some("favorites-changed");
            Value::Null
        }
        "playlists.list" => {
            #[derive(Deserialize)]
            #[serde(deny_unknown_fields)]
            struct Query { query: Option<String>, limit: Option<usize>, cursor: Option<String>, sort: Option<String> }
            let input: Query = parse(params)?;
            let query = input.query.unwrap_or_default().to_lowercase();
            let sort = input.sort.as_deref().unwrap_or("id");
            if !matches!(sort, "id" | "title") { return Err(Error::new("INVALID_ARGUMENT", "Unknown sort")); }
            let mut lists = playlists::read_playlists(&db).map_err(internal)?;
            lists.retain(|p| p.name.to_lowercase().contains(&query));
            if sort == "title" { lists.sort_by(|a,b| a.name.cmp(&b.name).then(a.id.cmp(&b.id))); }
            else { lists.sort_by(|a,b| a.id.cmp(&b.id)); }
            let items = lists.iter().map(|p| json!({"id":p.id,"name":p.name,"trackIds":p.tracks.iter().map(track_id).collect::<Vec<_>>()})).collect();
            paginate(items, input.limit.unwrap_or(50), input.cursor.as_deref(), &json!(["playlists",query,sort]))?
        }
        "playlists.get" | "playlists.listTracks" => {
            let mut query = params.as_object().cloned().ok_or_else(|| Error::new("INVALID_ARGUMENT", "Expected playlistId"))?;
            let id = query.remove("playlistId").and_then(|v| v.as_str().map(String::from))
                .ok_or_else(|| Error::new("INVALID_ARGUMENT", "Expected playlistId"))?;
            let list = playlists::read_playlists(&db).map_err(internal)?.into_iter().find(|p| p.id == id)
                .ok_or_else(|| Error::new("NOT_FOUND", "Playlist not found"))?;
            if method == "playlists.get" {
                if !query.is_empty() { return Err(Error::new("INVALID_ARGUMENT", "Unexpected playlist parameters")); }
                json!({"id":list.id,"name":list.name,"revision":playlist_revision(&list.tracks),"trackIds":list.tracks.iter().map(track_id).collect::<Vec<_>>()})
            } else { ordered_tracks(&list.tracks, &Value::Object(query), "playlist")? }
        }
        "playlists.create" => {
            #[derive(Deserialize)]
            #[serde(rename_all="camelCase",deny_unknown_fields)]
            struct Create { name:String, #[serde(default)] track_ids:Vec<String> }
            let input:Create=parse(params)?;
            if input.name.trim().is_empty() || input.name.len()>256 || input.track_ids.len()>200 { return Err(Error::new("INVALID_ARGUMENT","Invalid playlist")); }
            let tracks=input.track_ids.iter().map(|id|resolve_known(db,id,queued)).collect::<Result<Vec<_>>>()?;
            let tx=db.transaction().map_err(|_|Error::new("INTERNAL","Cannot create playlist"))?;
            let id=playlists::create(&tx,&input.name,None,&tracks).map_err(internal)?;
            tx.commit().map_err(|_|Error::new("INTERNAL","Cannot create playlist"))?;
            changed=Some("playlists-changed"); json!({"id":id})
        }
        "playlists.update" | "playlists.delete" | "playlists.reorderTracks" => {
            #[derive(Deserialize)]
            #[serde(rename_all="camelCase",deny_unknown_fields)]
            struct Edit { playlist_id:String, name:Option<String>, expected_revision:Option<String>, track_ids:Option<Vec<String>> }
            let input:Edit=parse(params)?;
            let list=playlists::read_playlists(db).map_err(internal)?.into_iter().find(|p|p.id==input.playlist_id).ok_or_else(||Error::new("NOT_FOUND","Playlist not found"))?;
            let invalid=||Error::new("INVALID_ARGUMENT","Invalid playlist edit");
            let tx=db.transaction().map_err(|_|Error::new("INTERNAL","Cannot update playlist"))?;
            match method {
                "playlists.update" => {
                    let name=input.name.as_deref().filter(|s|!s.trim().is_empty() && s.len()<=256).ok_or_else(invalid)?;
                    if input.track_ids.is_some() || input.expected_revision.is_some() { return Err(invalid()); }
                    playlists::rename(&tx,&input.playlist_id,name).map_err(internal)?;
                }
                "playlists.delete" => {
                    if input.name.is_some() || input.track_ids.is_some() || input.expected_revision.is_some() { return Err(invalid()); }
                    playlists::delete(&tx,&input.playlist_id).map_err(internal)?;
                }
                _ => {
                    if input.name.is_some() { return Err(invalid()); }
                    if input.expected_revision.as_deref()!=Some(&playlist_revision(&list.tracks)) { return Err(Error::new("CONFLICT","Playlist changed")); }
                    let ids=input.track_ids.ok_or_else(invalid)?;
                    if ids.len()!=list.tracks.len() || ids.iter().collect::<std::collections::HashSet<_>>().len()!=ids.len() { return Err(invalid()); }
                    let tracks=ids.iter().map(|id|list.tracks.iter().find(|t|track_id(t)==*id).cloned().ok_or_else(invalid)).collect::<Result<Vec<_>>>()?;
                    playlists::reorder(&tx,&input.playlist_id,&tracks).map_err(internal)?;
                }
            }
            tx.commit().map_err(|_|Error::new("INTERNAL","Cannot update playlist"))?;
            changed=Some("playlists-changed"); Value::Null
        }
        "playlists.addTracks" | "playlists.removeTracks" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase", deny_unknown_fields)]
            struct Edit { playlist_id: String, track_ids: Vec<String> }
            let input: Edit = parse(params)?;
            if input.track_ids.len() > 200 { return Err(Error::new("INVALID_ARGUMENT", "At most 200 tracks per operation")); }
            if !playlists::read_playlists(&db).map_err(internal)?.iter().any(|p| p.id == input.playlist_id) {
                return Err(Error::new("NOT_FOUND", "Playlist not found"));
            }
            let tracks = input.track_ids.iter().map(|id| resolve_known(&db, id, queued)).collect::<Result<Vec<_>>>()?;
            let transaction = db.transaction().map_err(|_| Error::new("INTERNAL", "Cannot update playlist"))?;
            playlists::edit_tracks(&transaction, &input.playlist_id, &tracks, method == "playlists.addTracks").map_err(internal)?;
            transaction.commit().map_err(|_| Error::new("INTERNAL", "Cannot update playlist"))?;
            changed = Some("playlists-changed");
            Value::Null
        }
        _ => return Err(Error::new("UNSUPPORTED", "Unknown collection method")),
    };
    Ok((result, changed))
}

fn playlist_revision(tracks:&[crate::models::Track]) -> String {
    use sha2::{Digest,Sha256};
    format!("{:x}",Sha256::digest(serde_json::to_vec(&tracks.iter().map(track_id).collect::<Vec<_>>()).unwrap()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Track;

    fn execute(db: &mut rusqlite::Connection, method: &str, params: &Value) -> Result<(Value, Option<&'static str>)> {
        execute_with_tracks(db, method, params, &[])
    }

    #[test]
    fn playlist_crud_and_reorder_are_atomic_and_revision_checked() {
        let mut db=rusqlite::Connection::open_in_memory().unwrap();
        crate::database::init_database(&db).unwrap();
        db.execute("INSERT INTO tracks(id,path,title) VALUES(1,'a.mp3','A'),(2,'b.mp3','B')",[]).unwrap();
        let tracks=crate::database::read_tracks(&db).unwrap();
        let ids=tracks.iter().map(track_id).collect::<Vec<_>>();
        let id=execute(&mut db,"playlists.create",&json!({"name":"Test","trackIds":ids})).unwrap().0["id"].as_str().unwrap().to_string();
        let info=execute(&mut db,"playlists.get",&json!({"playlistId":id})).unwrap().0;
        assert!(execute(&mut db,"playlists.reorderTracks",&json!({"playlistId":id,"trackIds":[ids[1],ids[0]],"expectedRevision":"stale"})).is_err());
        execute(&mut db,"playlists.reorderTracks",&json!({"playlistId":id,"trackIds":[ids[1],ids[0]],"expectedRevision":info["revision"]})).unwrap();
        assert_eq!(execute(&mut db,"playlists.get",&json!({"playlistId":id})).unwrap().0["trackIds"],json!([ids[1],ids[0]]));
        execute(&mut db,"playlists.update",&json!({"playlistId":id,"name":"Renamed"})).unwrap();
        assert_eq!(execute(&mut db,"playlists.get",&json!({"playlistId":id})).unwrap().0["name"],"Renamed");
        execute(&mut db,"playlists.delete",&json!({"playlistId":id})).unwrap();
        assert_eq!(execute(&mut db,"playlists.get",&json!({"playlistId":id})).unwrap_err().code,"NOT_FOUND");
    }
    #[test]
    fn playing_unsaved_online_track_can_be_added_to_favorites() {
        let mut db = rusqlite::Connection::open_in_memory().unwrap();
        crate::database::init_database(&db).unwrap();
        let track: Track = serde_json::from_value(json!({"id":-1,"path":"plugin://provider/one","title":"Queued","sourceProviderId":"provider","sourceId":"one"})).unwrap();
        let id = track_id(&track);
        execute_with_tracks(&mut db, "favorites.set", &json!({"trackId":id,"favorite":true}), &[track]).unwrap();
        assert_eq!(execute(&mut db, "favorites.contains", &json!({"trackId":id})).unwrap().0, true);
    }

    #[test]
    fn playlist_pagination_preserves_saved_order_and_rejects_stale_cursor() {
        let mut db = rusqlite::Connection::open_in_memory().unwrap();
        crate::database::init_database(&db).unwrap();
        let tracks: Vec<Track> = [3, 1, 2].into_iter().map(|id| serde_json::from_value(json!({
            "id":id,"path":format!("C:/music/{id}.mp3"),"title":format!("Song {id}")
        })).unwrap()).collect();
        let id = playlists::create(&db, "Ordered", None, &tracks).unwrap();
        let first = execute(&mut db, "playlists.listTracks", &json!({"playlistId":id,"limit":1})).unwrap().0;
        assert_eq!(first["items"][0]["id"], track_id(&tracks[0]));
        let second = execute(&mut db, "playlists.listTracks", &json!({"playlistId":id,"limit":1,"cursor":first["nextCursor"]})).unwrap().0;
        assert_eq!(second["items"][0]["id"], track_id(&tracks[1]));
        let sorted = execute(&mut db, "playlists.listTracks", &json!({"playlistId":id,"sort":"title"})).unwrap().0;
        assert_eq!(sorted["items"][0]["id"], track_id(&tracks[1]));
        playlists::edit_tracks(&db, &id, &[tracks[0].clone()], false).unwrap();
        assert_eq!(execute(&mut db, "playlists.listTracks", &json!({"playlistId":id,"cursor":first["nextCursor"]})).unwrap_err().code, "CONFLICT");
    }

    #[test]
    fn saved_remote_tracks_can_be_favorited_and_moved_without_numeric_id_collisions() {
        let mut db = rusqlite::Connection::open_in_memory().unwrap();
        crate::database::init_database(&db).unwrap();
        db.execute("INSERT INTO tracks(id,path,title) VALUES(1,'C:/Music/local.mp3','Local')", []).unwrap();
        let remote: Track = serde_json::from_value(json!({"id":1,"path":"plugin://provider/one","title":"Remote","sourceProviderId":"provider","sourceId":"one","sourceRaw":{"secret":"private"}})).unwrap();
        let source = playlists::create(&db, "Source", None, &[remote.clone()]).unwrap();
        let destination = playlists::create(&db, "Destination", None, &[]).unwrap();
        let id = track_id(&remote);
        let (page, _) = execute(&mut db, "playlists.listTracks", &json!({"playlistId":source})).unwrap();
        assert_eq!(page["items"][0]["id"], id);
        assert!(page["items"][0].get("sourceRaw").is_none());
        let (_, event) = execute(&mut db, "favorites.set", &json!({"trackId":id,"favorite":true})).unwrap();
        assert_eq!(event, Some("favorites-changed"));
        execute(&mut db, "favorites.set", &json!({"trackId":id,"favorite":true})).unwrap();
        assert_eq!(favorites::read_favorites(&db).unwrap().len(), 1);
        assert_eq!(execute(&mut db, "favorites.contains", &json!({"trackId":id})).unwrap().0, true);
        assert!(execute(&mut db, "playlists.addTracks", &json!({"playlistId":destination,"trackIds":[id,"track:missing"]})).is_err());
        assert_eq!(execute(&mut db, "playlists.get", &json!({"playlistId":destination})).unwrap().0["trackIds"], json!([]));
        execute(&mut db, "playlists.addTracks", &json!({"playlistId":destination,"trackIds":[id]})).unwrap();
        execute(&mut db, "playlists.removeTracks", &json!({"playlistId":source,"trackIds":[id]})).unwrap();
        assert_eq!(execute(&mut db, "playlists.get", &json!({"playlistId":destination})).unwrap().0["trackIds"], json!([id]));
        execute(&mut db, "favorites.set", &json!({"trackId":id,"favorite":false})).unwrap();
        assert_eq!(execute(&mut db, "favorites.contains", &json!({"trackId":id})).unwrap().0, false);
    }
}
