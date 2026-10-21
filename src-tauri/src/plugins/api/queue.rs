use crate::models::plugin_api::{Error, Result};
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::AppHandle;

pub(super) fn dispatch(app: &AppHandle, method: &str, params: &Value) -> Result<Value> {
    if method == "queue.get" {
        if !params.as_object().is_some_and(|p| p.is_empty()) { return Err(Error::new("INVALID_ARGUMENT", "queue.get does not accept parameters")); }
        let queue = crate::player::plugin_queue::view(app).map_err(|_| Error::new("INTERNAL", "Cannot read queue"))?;
        let items: Vec<_> = queue.tracks.iter().enumerate().map(|(index, track)| json!({
            "entryId":format!("{}:{index}", queue.revision), "track":super::library::public_track(track),
        })).collect();
        Ok(json!({"items":items,"revision":queue.revision,"currentEntryId":queue.current_index.map(|i| format!("{}:{i}", queue.revision))}))
    } else if method == "queue.play" {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase", deny_unknown_fields)]
        struct Play { entry_id: String }
        let input: Play = serde_json::from_value(params.clone()).map_err(|_| Error::new("INVALID_ARGUMENT", "Expected entryId"))?;
        let (revision, index) = parse_entry(&input.entry_id)?;
        if !crate::player::plugin_queue::play(app, revision, index).map_err(|_| Error::new("INTERNAL", "Cannot play queue entry"))? {
            return Err(Error::new("CONFLICT", "Queue changed; read the queue again"));
        }
        Ok(Value::Null)
    } else { edit(app,method,params) }
}

#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
struct Edit {
    expected_revision: String,
    #[serde(default)] track_ids: Vec<String>,
    #[serde(default)] entry_ids: Vec<String>,
    before_entry_id: Option<String>,
}
fn edit(app: &AppHandle, method: &str, params: &Value) -> Result<Value> {
    let input: Edit = serde_json::from_value(params.clone()).map_err(|_| Error::new("INVALID_ARGUMENT","Invalid queue edit"))?;
    if input.track_ids.len() > 200 { return Err(Error::new("INVALID_ARGUMENT","At most 200 tracks per edit")); }
    let queue = crate::player::plugin_queue::view(app).map_err(|_| Error::new("INTERNAL","Cannot read queue"))?;
    if input.expected_revision != queue.revision { return Err(Error::new("CONFLICT","Queue changed")); }
    let additions = input.track_ids.iter().map(|id|super::library::resolve_in_app(app,id)).collect::<Result<Vec<_>>>()?;
    let tracks = edited(queue.tracks,&queue.revision,method,&input,additions)?;
    if !crate::player::plugin_queue::replace(app,&input.expected_revision,tracks).map_err(|_| Error::new("INTERNAL","Cannot update queue"))? {
        return Err(Error::new("CONFLICT","Queue changed"));
    }
    dispatch(app,"queue.get",&json!({}))
}
fn edited(mut tracks: Vec<crate::models::Track>, revision: &str, method: &str, input: &Edit, additions: Vec<crate::models::Track>) -> Result<Vec<crate::models::Track>> {
    let invalid = || Error::new("INVALID_ARGUMENT","Invalid queue edit");
    let index = |id:&str| -> Result<usize> {
        let (rev,index) = parse_entry(id)?;
        if rev != revision || index >= tracks.len() { return Err(Error::new("CONFLICT","Queue entry changed")); }
        Ok(index)
    };
    let indices = input.entry_ids.iter().map(|id|index(id)).collect::<Result<Vec<_>>>()?;
    if indices.iter().collect::<std::collections::HashSet<_>>().len() != indices.len() { return Err(invalid()); }
    let before = input.before_entry_id.as_deref().map(index).transpose()?;
    match method {
        "queue.replace" | "queue.append" | "queue.insert" => {
            if !indices.is_empty() || (method != "queue.insert" && before.is_some()) { return Err(invalid()); }
            if method == "queue.replace" { tracks=additions; }
            else { tracks.splice(before.unwrap_or(tracks.len())..before.unwrap_or(tracks.len()),additions); }
        }
        "queue.remove" | "queue.reorder" | "queue.clear" => {
            if !additions.is_empty() || before.is_some() { return Err(invalid()); }
            if method == "queue.clear" { if !indices.is_empty() { return Err(invalid()); } tracks.clear(); }
            else if method == "queue.remove" { tracks = tracks.into_iter().enumerate().filter(|(i,_)|!indices.contains(i)).map(|(_,t)|t).collect(); }
            else { if indices.len()!=tracks.len() { return Err(invalid()); } tracks=indices.iter().map(|i|tracks[*i].clone()).collect(); }
        }
        _ => return Err(Error::new("UNSUPPORTED","Unknown queue edit")),
    }
    if tracks.len()>10000 { return Err(invalid()); }
    Ok(tracks)
}

fn parse_entry(id: &str) -> Result<(&str, usize)> {
    let invalid = || Error::new("INVALID_ARGUMENT", "Invalid queue entryId");
    let (revision, index) = id.split_once(':').ok_or_else(invalid)?;
    if revision.len() != 64 || !revision.bytes().all(|c| c.is_ascii_hexdigit()) { return Err(invalid()); }
    Ok((revision, index.parse().map_err(|_| invalid())?))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn edits_preserve_duplicate_tracks_and_reject_stale_or_partial_orders() {
        let track:crate::models::Track=serde_json::from_value(json!({"id":1,"path":"a.mp3","title":"A"})).unwrap();
        let revision="a".repeat(64);
        let mut input=Edit{expected_revision:revision.clone(),track_ids:vec![],entry_ids:vec![format!("{revision}:0")],before_entry_id:None};
        let tracks=vec![track.clone(),track.clone()];
        assert_eq!(edited(tracks.clone(),&revision,"queue.remove",&input,vec![]).unwrap().len(),1);
        assert!(edited(tracks.clone(),&revision,"queue.reorder",&input,vec![]).is_err());
        input.entry_ids=vec![format!("{revision}:1"),format!("{revision}:0")];
        assert_eq!(edited(tracks.clone(),&revision,"queue.reorder",&input,vec![]).unwrap().len(),2);
        input.entry_ids=vec![format!("{}:0","b".repeat(64))];
        assert_eq!(edited(tracks,&revision,"queue.remove",&input,vec![]).unwrap_err().code,"CONFLICT");
    }
    #[test]
    fn entry_requires_revision_and_index_not_a_track_id_or_file_path() {
        assert!(parse_entry(&format!("{}:3", "a".repeat(64))).is_ok());
        for id in ["track:1", "C:/Music/song.mp3", "4", "hash:-1"] { assert!(parse_entry(id).is_err()); }
    }
}
