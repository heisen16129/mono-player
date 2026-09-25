// SPDX-License-Identifier: GPL-3.0-only
export const defaults = {
  verticalOffset: 0, fontSize: 40, lineGap: 0.55, alignment: 'left', backgroundMode: 'fluid',
  blur: true, glow: true, float: true, scale: true, showCover: true,
  lyricStyle: 'standard', fanAngle: 30, tiltAngle: 25,
  glowAmount: 8, floatAmount: 8, glowScope: 'long',
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function configWithDefaults(config = {}) {
  const result = { ...defaults, ...config };
  result.fontSize = clamp(Number(result.fontSize) || 40, 20, 72);
  result.lineGap = clamp(Number(result.lineGap) || 0, 0, 1.5);
  for (const [key, min, max] of [['verticalOffset', 0, 60], ['fanAngle', -45, 45], ['tiltAngle', -45, 45], ['glowAmount', 0, 24], ['floatAmount', 0, 16]]) {
    result[key] = clamp(Number.isFinite(Number(result[key])) ? Number(result[key]) : defaults[key], min, max);
  }
  if (!['standard', 'glow', 'fan', 'vertical', 'perspective'].includes(result.lyricStyle)) result.lyricStyle = 'standard';
  return result;
}

export function createState() {
  return {
    trackKey: '', track: null, lines: [], lyricsSignature: null, queue: [], config: { ...defaults }, background: {},
    playback: { currentTime: 0, isPlaying: false, volume: 100, playbackRate: 1 },
    ui: { lyricTimeOffset: 0, isLoading: false, emptyMessage: '暂无歌词', loadingText: '正在加载歌词…' },
    clockAt: 0, clockCorrection: 0,
  };
}

export function applyMessage(state, message, now) {
  switch (message.type) {
    case 'track': {
      const changed = message.trackKey !== state.trackKey;
      const incoming = message.activeTrack;
      const keepArtwork = !changed && incoming && state.track &&
        incoming.coverVersion === state.track.coverVersion &&
        incoming.artwork === state.track.artwork && incoming.associatedArtwork === state.track.associatedArtwork;
      state.track = incoming ? { ...incoming,
        artworkDataUrl: incoming.artworkDataUrl || (keepArtwork ? state.track.artworkDataUrl : undefined),
      } : null;
      state.trackKey = message.trackKey;
      if (changed || !incoming) {
        state.lines = [];
        state.lyricsSignature = null;
        state.playback = { ...state.playback, currentTime: 0, isPlaying: false };
        state.ui = { ...state.ui, activeLyricIndex: -1, isLoading: Boolean(incoming) };
        state.clockAt = now;
        state.clockCorrection = 0;
      }
      return changed || !incoming ? 'track-change' : 'track';
    }
    case 'lyrics': {
      if (message.trackKey !== state.trackKey) return false;
      const lines = message.lines || [];
      const signature = JSON.stringify(lines);
      state.ui.isLoading = false;
      // postMessage clones arrays; identity changes are not lyric changes.
      // Keep the mounted rows and ongoing scroll when the host resends a snapshot.
      if (signature === state.lyricsSignature) return 'lyrics-status';
      state.lines = lines;
      state.lyricsSignature = signature;
      break;
    }
    case 'playback': {
      // Re-anchor partial updates too, so toggling pause never jumps back to the last tick.
      const predicted = playbackTime(state, now);
      const next = { ...state.playback, currentTime: predicted, ...message.playback };
      const difference = predicted - next.currentTime;
      // Converge small transport jitter over 500ms instead of crossing the same
      // lyric boundary twice. Larger discontinuities (seeks) apply immediately.
      state.clockCorrection = state.playback.isPlaying && next.isPlaying &&
        Math.abs(difference) <= .2 * Math.min(state.playback.playbackRate || 1, next.playbackRate || 1)
        ? difference : 0;
      state.playback = next;
      state.clockAt = now;
      break;
    }
    case 'lyrics-ui': state.ui = { ...state.ui, ...message.lyricsUi }; break;
    case 'config': state.config = configWithDefaults(message.config); break;
    case 'background': state.background = message.background || {}; break;
    case 'queue': state.queue = message.queueTracks || []; break;
    default: return false;
  }
  return message.type;
}

export function playbackTime(state, now) {
  const { currentTime, isPlaying, playbackRate } = state.playback;
  const elapsed = isPlaying ? clamp((now - state.clockAt) / 1000, 0, 1.5) * (playbackRate || 1) : 0;
  const correction = isPlaying ? state.clockCorrection * Math.max(0, 1 - (now - state.clockAt) / 500) : 0;
  return clamp((currentTime || 0) + elapsed + correction, 0, state.track?.duration || Infinity);
}

export const lyricTime = (state, now) => playbackTime(state, now) + (state.ui.lyricTimeOffset || 0);

export function activeLine(lines, time) {
  let index = -1;
  for (let i = 0; i < lines.length; i++) {
    if (Number.isFinite(lines[i].time) && lines[i].time <= time) index = i;
  }
  return index;
}

export function wordProgress(words, index, time, lineEnd) {
  const word = words[index];
  const duration = Number.isFinite(word.duration) && word.duration >= 0
    ? word.duration : Math.max(0, (words[index + 1]?.time ?? lineEnd ?? word.time + 1) - word.time);
  return { duration, progress: duration > 0 ? clamp((time - word.time) / duration, 0, 1) : Number(time >= word.time) };
}

export const artistName = (track) => Array.isArray(track?.artist) ? track.artist.join(' / ') : track?.artist || '';
export const artwork = (track) => track?.artworkDataUrl || track?.associatedArtwork || track?.artwork || '';
export function formatTime(time) {
  const seconds = Math.max(0, Math.floor(time || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
