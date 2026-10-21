use super::*;
use sha2::{Digest, Sha256};

pub(crate) struct QueueView {
    pub revision: String,
    pub tracks: Vec<Track>,
    pub current_index: Option<usize>,
}

fn revision(tracks: &[QueueTrack]) -> String {
    format!("{:x}", Sha256::digest(serde_json::to_vec(tracks).unwrap()))
}

// Playback order may be shuffled; duplicate occurrences remain distinct entries.
fn map_occurrence(from: &[String], to: &[String], index: usize) -> Option<usize> {
    let key = from.get(index)?;
    let occurrence = from[..index].iter().filter(|source|*source==key).count();
    to.iter().enumerate().filter(|(_,source)|*source==key).nth(occurrence).map(|(index,_)|index)
}

pub(crate) fn view(app: &AppHandle) -> Result<QueueView, String> {
    let state = app.state::<PlayerState>();
    let backend = state.inner.lock().map_err(|e| e.to_string())?;
    let current = backend.current_source.as_deref().and_then(|source| queue_source_key_for_source(&backend.queue_tracks, source));
    let keys: Vec<_> = backend.queue_tracks.iter().map(queue_track_source_key).collect();
    let current_index = backend.queue_index.and_then(|index|map_occurrence(&backend.queue_sources,&keys,index))
        .or_else(|| current.and_then(|source| keys.iter().position(|key|*key==source)));
    let tracks = backend.queue_tracks.iter().map(|track| serde_json::from_value(serde_json::to_value(track).unwrap()).map_err(|e| e.to_string()))
        .collect::<Result<Vec<Track>, String>>()?;
    Ok(QueueView { revision: revision(&backend.queue_tracks), tracks, current_index })
}

// Check the revision under the same lock that selects the source. A stale UI
// entry must never play whatever now happens to occupy its former index.
pub(crate) fn play(app: &AppHandle, expected: &str, index: usize) -> Result<bool, String> {
    let state = app.state::<PlayerState>();
    let (source, queue_index, generation) = {
        let mut backend = state.inner.lock().map_err(|e| e.to_string())?;
        if revision(&backend.queue_tracks) != expected { return Ok(false); }
        let Some(track) = backend.queue_tracks.get(index) else { return Ok(false); };
        let key = queue_track_source_key(track);
        if !queue_source_exists_for_backend(&backend,&key) { return Err("Queue entry is not playable".into()); }
        let source = key;
        let keys: Vec<_> = backend.queue_tracks.iter().map(queue_track_source_key).collect();
        let queue_index = map_occurrence(&keys,&backend.queue_sources,index).ok_or("Queue entry is not playable")?;
        backend.queue_index = Some(queue_index);
        let generation = next_playback_generation(&mut backend);
        (source, queue_index, generation)
    };
    let _ = app.state::<crate::workers::audio::AudioWorkerState>().stop(false);
    let snapshot = play_queue_source(&state.inner, app, source, Some(queue_index), Some(generation))?;
    emit_queue_snapshot(app, "plugin_queue_play", &snapshot);
    Ok(true)
}

// Compare and replace under one lock; callers have already resolved public track IDs.
pub(crate) fn replace(app: &AppHandle, expected: &str, tracks: Vec<Track>) -> Result<bool, String> {
    let state = app.state::<PlayerState>();
    let snapshot = {
        let mut backend = state.inner.lock().map_err(|e|e.to_string())?;
        if revision(&backend.queue_tracks) != expected { return Ok(false); }
        let current = backend.current_source.as_deref().and_then(|source|queue_source_key_for_source(&backend.queue_tracks,source));
        backend.queue_tracks = tracks.into_iter().map(model_track_to_queue_track).collect();
        let (mode,_,_)=queue_playback_options(&backend);
        backend.queue_sources = build_play_order_sources(&backend.queue_tracks,current.as_deref(),&mode);
        backend.queue_index = current.and_then(|key|backend.queue_sources.iter().position(|source|*source==key));
        backend.queued_next_source = None;
        queue_snapshot_from_backend(&mut backend)
    };
    emit_queue_snapshot(app,"plugin_queue_edit",&snapshot);
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shuffled_play_order_maps_duplicate_entries_without_selecting_first_copy() {
        let tracks=vec!["a".into(),"b".into(),"a".into()];
        let order=vec!["b".into(),"a".into(),"a".into()];
        assert_eq!(map_occurrence(&tracks,&order,0),Some(1));
        assert_eq!(map_occurrence(&tracks,&order,2),Some(2));
        assert_eq!(map_occurrence(&order,&tracks,0),Some(1));
        assert_eq!(map_occurrence(&tracks,&[],0),None);
    }
}
