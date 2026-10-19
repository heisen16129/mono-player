#[derive(Default)]
pub(super) struct RecentPlaybackTracker {
    active_path: Option<String>,
}

impl RecentPlaybackTracker {
    pub(super) fn observe(
        &mut self,
        path: Option<&str>,
        playing: bool,
        buffering: bool,
        failed: bool,
    ) -> Option<String> {
        if !playing || failed || path.is_none() {
            self.active_path = None;
            return None;
        }
        if buffering {
            return None;
        }
        let path = path?;
        if self.active_path.as_deref() == Some(path) {
            return None;
        }
        self.active_path = Some(path.to_string());
        Some(path.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn records_only_actual_playback_transitions() {
        let mut tracker = RecentPlaybackTracker::default();
        assert!(tracker.observe(Some("a"), false, false, false).is_none());
        assert!(tracker.observe(Some("a"), true, true, false).is_none());
        assert!(tracker.observe(Some("a"), true, false, true).is_none());
        assert_eq!(
            tracker.observe(Some("a"), true, false, false).as_deref(),
            Some("a")
        );
        assert!(tracker.observe(Some("a"), true, false, false).is_none());
        assert_eq!(
            tracker.observe(Some("b"), true, false, false).as_deref(),
            Some("b")
        );
        tracker.observe(None, false, false, false);
        assert_eq!(
            tracker.observe(Some("b"), true, false, false).as_deref(),
            Some("b")
        );
    }
}
