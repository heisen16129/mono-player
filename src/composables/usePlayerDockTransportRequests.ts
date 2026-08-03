const PREVIOUS_TRACK_THROTTLE_MS = 120;

interface PlayerDockTransportRequestOptions {
  onNext: () => void;
  onPrevious: () => void;
  onToggleFavorite: () => void;
  onTogglePlaybackMode: () => void;
}

export function usePlayerDockTransportRequests(options: PlayerDockTransportRequestOptions) {
  let lastPreviousTap = 0;

  function requestPreviousTrack() {
    const now = window.performance.now();
    if (now - lastPreviousTap < PREVIOUS_TRACK_THROTTLE_MS) return;
    lastPreviousTap = now;
    options.onPrevious();
  }

  function requestNextTrack() {
    options.onNext();
  }

  function requestPlaybackModeToggle() {
    options.onTogglePlaybackMode();
  }

  function requestFavoriteToggle() {
    options.onToggleFavorite();
  }

  return {
    requestFavoriteToggle,
    requestNextTrack,
    requestPlaybackModeToggle,
    requestPreviousTrack,
  };
}
