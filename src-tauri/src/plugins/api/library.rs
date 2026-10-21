use crate::models::{artist_names, plugin_api::{Error, Result}, Track};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tauri::AppHandle;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Query {
    #[serde(default)]
    query: String,
    limit: Option<usize>,
    cursor: Option<String>,
    sort: Option<String>,
}

pub(super) fn track_id(track: &Track) -> String {
    format!("track:{:x}", Sha256::digest(crate::database::favorites::identity_key(track).as_bytes()))
}

pub(super) fn resolve(db: &rusqlite::Connection, id: &str) -> Result<Track> {
    let failure = |_| Error::new("INTERNAL", "Cannot read tracks");
    let mut tracks = crate::database::read_tracks(db).map_err(failure)?;
    tracks.extend(crate::database::imported_tracks::read(db).map_err(failure)?);
    tracks.extend(crate::database::favorites::read_favorites(db).map_err(failure)?.into_iter().map(|f| f.track));
    tracks.extend(crate::database::playlists::read_playlists(db).map_err(failure)?.into_iter().flat_map(|p| p.tracks));
    tracks.into_iter().find(|track| track_id(track) == id)
        .ok_or_else(|| Error::new("NOT_FOUND", "Track not found"))
}

pub(super) fn resolve_in_app(app: &AppHandle, id: &str) -> Result<Track> {
    use tauri::Manager;
    let saved = {
        let state = app.state::<crate::state::AppState>();
        let db = state.db.lock().map_err(|_| Error::new("INTERNAL", "Cannot read library"))?;
        resolve(&db, id)
    };
    match saved {
        Ok(track) => Ok(track),
        Err(error) if error.code == "NOT_FOUND" => {
            crate::player::plugin_queue::view(app).map_err(|_| Error::new("INTERNAL", "Cannot read queue"))?
                .tracks.into_iter().find(|track| track_id(track) == id).ok_or(error)
        }
        Err(error) => Err(error),
    }
}

pub(super) fn public_track(track: &Track) -> Value {
    let source = match &track.source_provider_id {
        Some(provider) => {
            let mut source = json!({"kind":"remote","providerId":provider});
            if let Some(id) = &track.source_id { source["sourceId"] = json!(id); }
            source
        },
        None => json!({"kind":"local"}),
    };
    json!({
        "id":track_id(track), "title":track.title,
        "artists":track.artist.as_deref().map(artist_names).unwrap_or_default(),
        "album":track.album, "duration":track.duration,
        "artworkRef":(track.source_provider_id.is_none() || track.artwork.is_some() || track.associated_artwork.is_some()).then(|| track_id(track).replacen("track:", "artwork:", 1)),
        "source":source,
    })
}

pub(crate) fn list(app: &AppHandle, params: &Value) -> Result<Value> {
    use tauri::Manager;
    let mut tracks = crate::library_service::read_tracks(app)
        .map_err(|_| Error::new("INTERNAL", "Cannot read library"))?;
    let state = app.state::<crate::state::AppState>();
    let db = state.db.lock().map_err(|_| Error::new("INTERNAL", "Cannot read library"))?;
    tracks.extend(crate::database::imported_tracks::read(&db).map_err(|_| Error::new("INTERNAL", "Cannot read imported tracks"))?);
    list_tracks(&tracks, params)
}

pub(super) fn groups(app:&AppHandle, method:&str, params:&Value) -> Result<Value> {
    use tauri::Manager;
    let query:Query=serde_json::from_value(params.clone()).map_err(|_|Error::new("INVALID_ARGUMENT","Invalid query"))?;
    let sort=query.sort.as_deref().unwrap_or("id");
    if !matches!(sort,"id"|"title") { return Err(Error::new("INVALID_ARGUMENT","Unknown sort")); }
    let state=app.state::<crate::state::AppState>();
    let db=state.db.lock().map_err(|_|Error::new("INTERNAL","Cannot read library"))?;
    let mut tracks=crate::database::read_tracks(&db).map_err(|_|Error::new("INTERNAL","Cannot read tracks"))?;
    tracks.extend(crate::database::imported_tracks::read(&db).map_err(|_|Error::new("INTERNAL","Cannot read tracks"))?);
    let mut groups=std::collections::BTreeMap::<String,usize>::new();
    for track in tracks {
        let names=if method=="library.listArtists" { track.artist.as_deref().map(artist_names).unwrap_or_default() }
            else { track.album.into_iter().collect() };
        for name in names.into_iter().collect::<std::collections::HashSet<_>>() {
            if !name.trim().is_empty() && name.to_lowercase().contains(&query.query.to_lowercase()) { *groups.entry(name).or_default()+=1; }
        }
    }
    let mut items:Vec<Value>=groups.into_iter().map(|(name,count)|json!({"id":format!("group:{:x}",Sha256::digest(format!("{method}:{name}").as_bytes())),"name":name,"trackCount":count})).collect();
    if sort=="id" { items.sort_by(|a,b|a["id"].as_str().cmp(&b["id"].as_str())); }
    paginate(items,query.limit.unwrap_or(50),query.cursor.as_deref(),&json!([method,query.query,sort]))
}

pub(super) fn list_tracks(tracks: &[Track], params: &Value) -> Result<Value> {
    ordered_tracks(tracks, params, "id")
}

pub(super) fn ordered_tracks(tracks: &[Track], params: &Value, default_sort: &str) -> Result<Value> {
    let query: Query = serde_json::from_value(params.clone())
        .map_err(|_| Error::new("INVALID_ARGUMENT", "Invalid track query"))?;
    let limit = query.limit.unwrap_or(50);
    if !(1..=200).contains(&limit) { return Err(Error::new("INVALID_ARGUMENT", "Limit must be between 1 and 200")); }
    if query.sort.as_deref().is_some_and(|sort| !matches!(sort, "id" | "title")) { return Err(Error::new("INVALID_ARGUMENT", "Unknown sort")); }
    let sort = query.sort.as_deref().unwrap_or(default_sort);
    let needle = query.query.to_lowercase();
    let mut tracks: Vec<_> = tracks.iter().filter(|track| {
        [&track.title, track.artist.as_deref().unwrap_or_default(), track.album.as_deref().unwrap_or_default()]
            .iter().any(|text| text.to_lowercase().contains(&needle))
    }).collect();
    if sort == "title" { tracks.sort_by(|a,b| a.title.cmp(&b.title).then(a.id.cmp(&b.id))); }
    else if sort == "id" { tracks.sort_by_key(|t| t.id); }
    let items: Vec<_> = tracks.into_iter().map(public_track).collect();
    paginate(items, limit, query.cursor.as_deref(), &json!([needle, sort]))
}

pub(super) fn paginate(items: Vec<Value>, limit: usize, cursor: Option<&str>, scope: &Value) -> Result<Value> {
    if !(1..=200).contains(&limit) { return Err(Error::new("INVALID_ARGUMENT", "Limit must be between 1 and 200")); }
    let revision = format!("{:x}", Sha256::digest(serde_json::to_vec(&json!([scope, items])).unwrap()));
    let offset = match cursor {
        None => 0,
        Some(cursor) => {
            let (snapshot, offset) = cursor.split_once(':').ok_or_else(|| Error::new("INVALID_ARGUMENT", "Invalid cursor"))?;
            let offset = offset.parse::<usize>().map_err(|_| Error::new("INVALID_ARGUMENT", "Invalid cursor"))?;
            if snapshot != revision { return Err(Error::new("CONFLICT", "Library query changed; restart pagination")); }
            if offset > items.len() { return Err(Error::new("INVALID_ARGUMENT", "Cursor outside result")); }
            offset
        }
    };
    let end = offset.saturating_add(limit).min(items.len());
    Ok(json!({"items":items[offset..end], "nextCursor":(end < items.len()).then(|| format!("{revision}:{end}")), "revision":revision, "total":items.len()}))
}

pub(crate) fn get(app: &AppHandle, params: &Value) -> Result<Value> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    struct Get { track_id: String }
    let params: Get = serde_json::from_value(params.clone()).map_err(|_| Error::new("INVALID_ARGUMENT", "Expected trackId"))?;
    resolve_in_app(app, &params.track_id).map(|track| public_track(&track))
}

pub(super) fn remove(app: &AppHandle, params: &Value) -> Result<Value> {
    use tauri::{Manager, Emitter};
    #[derive(Deserialize)]
    #[serde(rename_all="camelCase", deny_unknown_fields)]
    struct Input { track_id:String }
    let input: Input = serde_json::from_value(params.clone()).map_err(|_| Error::new("INVALID_ARGUMENT","Expected trackId"))?;
    let state = app.state::<crate::state::AppState>();
    let mut db = state.db.lock().map_err(|_| Error::new("INTERNAL","Cannot access library"))?;
    let track = resolve(&db, &input.track_id)?;
    remove_saved(&mut db,&track).map_err(|_| Error::new("INTERNAL","Cannot remove track"))?;
    drop(db);
    for event in ["library-changed","favorites-changed","playlists-changed"] { let _ = app.emit(event, ()); }
    Ok(Value::Null)
}

fn remove_saved(db: &mut rusqlite::Connection, track: &Track) -> rusqlite::Result<()> {
    let identity = crate::database::favorites::identity_key(track);
    let tx = db.transaction()?;
    tx.execute("DELETE FROM playlist_tracks WHERE identity_key=?1", [&identity])?;
    tx.execute("DELETE FROM favorites WHERE identity_key=?1", [&identity])?;
    tx.execute("DELETE FROM imported_tracks WHERE identity_key=?1", [&identity])?;
    if track.source_provider_id.is_none() { tx.execute("DELETE FROM tracks WHERE id=?1 AND path=?2", rusqlite::params![track.id,track.path])?; }
    tx.commit()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn removal_clears_saved_references_without_touching_another_track_with_same_id() {
        let mut db = rusqlite::Connection::open_in_memory().unwrap();
        crate::database::init_database(&db).unwrap();
        db.execute("INSERT INTO tracks(id,path,title) VALUES(1,'C:/music/local.mp3','Local')",[]).unwrap();
        let remote: Track = serde_json::from_value(json!({"id":1,"path":"plugin://p/1","title":"Remote","sourceProviderId":"p","sourceId":"1"})).unwrap();
        crate::database::imported_tracks::insert(&mut db,&[remote.clone()]).unwrap();
        crate::database::playlists::create(&db,"Songs",None,&[remote.clone()]).unwrap();
        crate::database::favorites::insert_favorite(&db,&remote).unwrap();
        remove_saved(&mut db,&remote).unwrap();
        assert!(resolve(&db,&track_id(&remote)).is_err());
        assert_eq!(crate::database::read_tracks(&db).unwrap().len(),1);
        assert!(crate::database::favorites::read_favorites(&db).unwrap().is_empty());
        assert!(crate::database::playlists::read_playlists(&db).unwrap()[0].tracks.is_empty());
    }
    #[test]
    fn imported_tracks_resolve_by_public_identity_without_local_id_collision() {
        let mut db = rusqlite::Connection::open_in_memory().unwrap();
        crate::database::init_database(&db).unwrap();
        db.execute("INSERT INTO tracks(id,path,title) VALUES(1,'C:/music/local.mp3','Local')", []).unwrap();
        let remote: Track = serde_json::from_value(json!({"id":1,"path":"plugin://p/1",
            "title":"Remote","sourceProviderId":"p","sourceId":"1"})).unwrap();
        let expected = track_id(&remote);
        crate::database::imported_tracks::insert(&mut db, &[remote]).unwrap();
        let resolved = resolve(&db, &expected).unwrap();
        assert_eq!(resolved.title, "Remote");
        assert!(resolved.id < 0);
        assert_eq!(public_track(&resolved)["id"], expected);
    }
    fn track(id: i64) -> Track {
        serde_json::from_value(json!({"id":id,"path":format!("C:/private/song{id}.mp3"),"title":format!("Song {id}"),"artist":["A","B"],"sourceRaw":{"secret":"token"}})).unwrap()
    }
    #[test]
    fn pagination_is_stable_and_does_not_expose_private_fields() {
        let tracks = vec![track(2), track(1)];
        let first = list_tracks(&tracks, &json!({"limit":1})).unwrap();
        assert_eq!(first["items"][0]["id"], track_id(&track(1)));
        assert_eq!(first["items"][0]["artists"], json!(["A","B"]));
        assert!(first["items"][0].get("path").is_none());
        assert!(first["items"][0].get("sourceRaw").is_none());
        let second = list_tracks(&tracks, &json!({"cursor":first["nextCursor"]})).unwrap();
        assert_eq!(second["items"][0]["id"], track_id(&track(2)));
        assert!(second["nextCursor"].is_null());
        assert_eq!(list_tracks(&tracks, &json!({"cursor":first["nextCursor"],"query":"Song 2"})).unwrap_err().code,"CONFLICT");
        assert!(list_tracks(&tracks, &json!({"limit":201})).is_err());
    }

    #[test]
    fn public_identity_does_not_collide_for_saved_tracks_with_equal_numeric_ids() {
        let first = track(1);
        let mut second = track(1);
        second.path = "plugin://provider/second".into();
        second.source_provider_id = Some("provider".into());
        second.source_id = Some("second".into());
        assert_ne!(track_id(&first), track_id(&second));
        let id = track_id(&second);
        second.id = 999;
        assert_eq!(track_id(&second), id);
    }
}
