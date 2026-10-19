use super::{PluginSearchPage, PluginSearchTrack};
use crate::api_response::ApiResponse;
use std::{collections::HashSet, sync::Mutex};
use tauri::{AppHandle, Manager};

#[derive(Default)]
pub(crate) struct OnlineSearchState(Mutex<Option<SearchSession>>);

#[derive(Default)]
pub(crate) struct LyricsSearchState(OnlineSearchState);

#[derive(Clone)]
struct SearchSession {
    id: String,
    provider_id: String,
    keyword: String,
    page: u64,
    tracks: Vec<PluginSearchTrack>,
    is_end: bool,
    busy: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SearchResult {
    session_id: String,
    tracks: Vec<PluginSearchTrack>,
    is_end: bool,
}

impl SearchSession {
    fn load(&mut self, mut fetch: impl FnMut(u64) -> Result<PluginSearchPage, String>) -> Result<(), String> {
        let mut keys: HashSet<_> = self.tracks.iter().map(|t| (t.provider_id.clone(), t.id.clone())).collect();
        for _ in 0..3 {
            if self.is_end { break; }
            let page = fetch(self.page + 1)?;
            self.page += 1;
            self.is_end = page.is_end || page.tracks.is_empty();
            let previous_count = self.tracks.len();
            self.tracks.extend(page.tracks.into_iter().filter(|t| keys.insert((t.provider_id.clone(), t.id.clone()))));
            if self.tracks.len() > previous_count { break; }
        }
        // A repeated page does not prove that the provider has reached its end.
        Ok(())
    }
}

impl OnlineSearchState {
    fn begin(&self, provider_id: String, keyword: String, session_id: Option<String>) -> Result<SearchSession, String> {
        let keyword = keyword.trim().to_string();
        if keyword.is_empty() || provider_id.trim().is_empty() { return Err("请选择搜索来源并输入关键词".into()); }
        let mut current = self.0.lock().map_err(|e| e.to_string())?;
        if let Some(id) = session_id {
            let session = current.as_mut().filter(|s| s.id == id && s.provider_id == provider_id && s.keyword == keyword).ok_or("搜索已变化，请重新搜索")?;
            if session.busy { return Err("正在加载搜索结果".into()); }
            session.busy = true;
            Ok(session.clone())
        } else {
            let session = SearchSession { id: uuid::Uuid::new_v4().to_string(), provider_id, keyword, page: 0, tracks: Vec::new(), is_end: false, busy: true };
            *current = Some(session.clone());
            Ok(session)
        }
    }

    fn finish(&self, mut session: SearchSession, result: Result<(), String>) -> Result<SearchResult, String> {
        let mut current = self.0.lock().map_err(|e| e.to_string())?;
        let active = current.as_mut().filter(|s| s.id == session.id).ok_or("搜索已变化，请重新搜索")?;
        active.busy = false;
        result?;
        session.busy = false;
        *active = session.clone();
        Ok(SearchResult { session_id: session.id, tracks: session.tracks, is_end: session.is_end })
    }
}

#[tauri::command]
pub(crate) async fn search_online_music(app: AppHandle, provider_id: String, keyword: String, session_id: Option<String>) -> ApiResponse<SearchResult> {
    search_selected_provider(app, provider_id, keyword, session_id, false).await
}

#[tauri::command]
pub(crate) async fn search_online_lyrics(app: AppHandle, provider_id: String, keyword: String, session_id: Option<String>) -> ApiResponse<SearchResult> {
    search_selected_provider(app, provider_id, keyword, session_id, true).await
}

async fn search_selected_provider(app: AppHandle, provider_id: String, keyword: String, session_id: Option<String>, lyrics: bool) -> ApiResponse<SearchResult> {
    // Reserve the session before dispatching blocking work so worker scheduling cannot reorder searches.
    let start = if lyrics {
        app.state::<LyricsSearchState>().0.begin(provider_id, keyword, session_id)
    } else {
        app.state::<OnlineSearchState>().begin(provider_id, keyword, session_id)
    };
    let mut session = match start {
        Ok(session) => session,
        Err(error) => return ApiResponse::error(error),
    };
    let result = tauri::async_runtime::spawn_blocking(move || {
        let result = (|| {
            let plugins = super::read_playback_plugin(&app, &session.provider_id)?;
            if !plugins.iter().any(|p| p.enabled && p.capabilities.iter().any(|c| c == if lyrics { "lyrics" } else { "play" })) {
                return Err(if lyrics { "选中的插件未启用或不支持歌词搜索" } else { "选中的插件未启用或不支持音乐搜索" }.into());
            }
            let worker = app.state::<crate::workers::plugin::PluginWorkerState>();
            let provider = session.provider_id.clone();
            let keyword = session.keyword.clone();
            session.load(|page| super::search_plugin_backend(&worker, provider.clone(), keyword.clone(), page, 30, plugins.clone()))
        })();
        if lyrics {
            app.state::<LyricsSearchState>().0.finish(session, result)
        } else {
            app.state::<OnlineSearchState>().finish(session, result)
        }
    }).await.map_err(|e| e.to_string()).and_then(|r| r);
    ApiResponse::from_result(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn page(ids: &[&str], is_end: bool) -> PluginSearchPage {
        PluginSearchPage { tracks: ids.iter().map(|id| PluginSearchTrack {
            id: id.to_string(), provider_id: "provider".into(), provider_name: "Provider".into(),
            title: id.to_string(), artist: vec![], album: String::new(), duration: None,
            artwork: None, year: None, genre: None, track_number: None, source_raw: serde_json::Value::Null,
        }).collect(), is_end }
    }

    #[test]
    fn lyrics_search_does_not_replace_music_session() {
        let music = OnlineSearchState::default();
        let lyrics = LyricsSearchState::default();
        let song = music.begin("provider".into(), "song".into(), None).unwrap();
        let lyric = lyrics.0.begin("provider".into(), "lyrics".into(), None).unwrap();
        let song_id = music.finish(song, Ok(())).unwrap().session_id;
        let lyric_id = lyrics.0.finish(lyric, Ok(())).unwrap().session_id;
        assert_ne!(song_id, lyric_id);
        assert!(music.begin("provider".into(), "song".into(), Some(song_id)).is_ok());
        assert!(lyrics.0.begin("provider".into(), "lyrics".into(), Some(lyric_id)).is_ok());
    }

    #[test]
    fn deduplicates_within_and_across_pages_preserving_order() {
        let state = OnlineSearchState::default();
        let mut session = state.begin("provider".into(), "song".into(), None).unwrap();
        session.load(|_| Ok(page(&["a", "a", "b"], false))).unwrap();
        let mut requested = Vec::new();
        session.load(|number| {
            requested.push(number);
            Ok(if number == 2 { page(&["b", "a"], false) } else { page(&["b", "c", "c"], true) })
        }).unwrap();
        assert_eq!(requested, vec![2, 3]);
        assert_eq!(session.tracks.iter().map(|t| t.id.as_str()).collect::<Vec<_>>(), vec!["a", "b", "c"]);
        assert!(session.is_end);
        session.load(|_| panic!("finished search must not request more pages")).unwrap();
    }

    #[test]
    fn repeated_pages_keep_correct_cursor_and_allow_more() {
        let state = OnlineSearchState::default();
        let mut session = state.begin("provider".into(), "song".into(), None).unwrap();
        session.load(|_| Ok(page(&["a"], false))).unwrap();
        session.load(|_| Ok(page(&["a"], false))).unwrap();
        assert_eq!(session.page, 4);
        assert!(!session.is_end);
        session.load(|number| { assert_eq!(number, 5); Ok(page(&[], false)) }).unwrap();
        assert!(session.is_end);
    }

    #[test]
    fn failed_load_preserves_results_and_retries_same_page() {
        let state = OnlineSearchState::default();
        let mut session = state.begin("provider".into(), "song".into(), None).unwrap();
        session.load(|_| Ok(page(&["a"], false))).unwrap();
        let id = state.finish(session, Ok(())).unwrap().session_id;
        let mut pending = state.begin("provider".into(), "song".into(), Some(id.clone())).unwrap();
        assert!(state.begin("provider".into(), "song".into(), Some(id.clone())).is_err());
        let result = pending.load(|number| if number == 2 { Ok(page(&["a"], false)) } else { Err("network error".into()) });
        assert!(state.finish(pending, result).is_err());
        let retry = state.begin("provider".into(), "song".into(), Some(id)).unwrap();
        assert_eq!(retry.page, 1);
        assert_eq!(retry.tracks.len(), 1);
    }

    #[test]
    fn new_search_rejects_old_results_and_wrong_provider() {
        let state = OnlineSearchState::default();
        let old = state.begin("provider".into(), "old".into(), None).unwrap();
        let new = state.begin("other".into(), "new".into(), None).unwrap();
        assert!(state.finish(old, Ok(())).is_err());
        let id = state.finish(new, Ok(())).unwrap().session_id;
        assert!(state.begin("provider".into(), "new".into(), Some(id.clone())).is_err());
        assert!(state.begin("other".into(), "old".into(), Some(id.clone())).is_err());
        let current = state.begin("other".into(), "new".into(), Some(id)).unwrap();
        assert!(current.tracks.is_empty());
        assert_eq!(current.page, 0);
    }
}
