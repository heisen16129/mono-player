const text = (value, fallback = '') => String(value ?? fallback).trim();

export function createContext() {
  return {
    activeTrack: null,
    queueTracks: [],
    lines: [],
    background: {},
    config: {},
    playback: {
      currentTime: 0,
      isPlaying: false,
      isFavorite: false,
      volume: 0,
      isMuted: false,
      playbackRate: 1,
      playbackMode: 'fixed',
      playbackModeLabel: '',
    },
    lyricsUi: {
      activeLyricIndex: -1,
      lyricTimeOffset: 0,
      fontSize: 17,
      lyricColor: null,
      useThemeLyricColor: true,
      isLoading: false,
      loadingText: '',
      emptyMessage: '',
      locale: 'zh-CN',
    },
  };
}

export function applyMessage(context, message) {
  if (message?.type === 'track') context.activeTrack = message.activeTrack || null;
  else if (message?.type === 'lyrics') context.lines = Array.isArray(message.lines) ? message.lines : [];
  else if (message?.type === 'queue') context.queueTracks = Array.isArray(message.queueTracks) ? message.queueTracks : [];
  else if (message?.type === 'background') context.background = message.background || {};
  else if (message?.type === 'config') context.config = message.config || {};
  else if (message?.type === 'playback') context.playback = { ...context.playback, ...(message.playback || {}) };
  else if (message?.type === 'lyrics-ui') context.lyricsUi = { ...context.lyricsUi, ...(message.lyricsUi || {}) };
  else return false;
  return true;
}

export function artwork(track) {
  return text(
    track?.artworkDataUrl
      || track?.associatedArtwork
      || track?.artwork,
  );
}

function artist(track) {
  if (Array.isArray(track?.artist)) return track.artist.filter(Boolean).join(' / ');
  return text(track?.artist);
}

function durationSeconds(track) {
  return Math.max(0, Number(track?.duration) || 0);
}

export function toSong(track) {
  if (!track) return null;
  return {
    id: text(track.id ?? track.path ?? `${track.title || ''}|${track.artist || ''}`),
    name: text(track.title, '未在播放'),
    title: text(track.title, '未在播放'),
    artist: artist(track),
    album: text(track.album),
    cover: artwork(track),
    duration: durationSeconds(track),
    source: 'local',
    provider: 'local',
    type: 'local',
  };
}

export function toRuntimeContext(context) {
  const activeSong = toSong(context?.activeTrack);
  const queue = (Array.isArray(context?.queueTracks) ? context.queueTracks : [])
    .map((track) => toSong(track))
    .filter(Boolean);
  if (activeSong && !queue.some((song) => song.id === activeSong.id)) queue.unshift(activeSong);
  const activeIndex = activeSong ? Math.max(0, queue.findIndex((song) => song.id === activeSong.id)) : -1;
  return {
    track: activeSong,
    queue,
    activeIndex,
    currentTime: Math.max(0, Number(context?.playback?.currentTime) || 0),
    duration: Math.max(0, Number(activeSong?.duration) || 0),
    playing: Boolean(context?.playback?.isPlaying),
    favorite: Boolean(context?.playback?.isFavorite),
    muted: Boolean(context?.playback?.isMuted),
    volume: Math.min(1, Math.max(0, (Number(context?.playback?.volume) || 0) / 100)),
    playbackRate: Math.max(0.25, Number(context?.playback?.playbackRate) || 1),
    playbackMode: text(context?.playback?.playbackMode, 'fixed'),
    background: {
      source: text(context?.background?.source, 'cover'),
      color: text(context?.background?.color, '#000000'),
      mediaUrl: text(context?.background?.mediaUrl),
      mediaKind: text(context?.background?.mediaKind, 'image'),
      wallpaperProjectType: text(context?.background?.wallpaperProjectType, 'unknown'),
      opacity: Math.min(1, Math.max(0, Number(context?.background?.opacity ?? .72))),
      windowOpacity: Math.min(1, Math.max(0, Number(context?.background?.windowOpacity ?? 1))),
      blur: Math.min(60, Math.max(0, Number(context?.background?.blur ?? 0))),
      positionX: Math.min(100, Math.max(0, Number(context?.background?.positionX ?? 50))),
      positionY: Math.min(100, Math.max(0, Number(context?.background?.positionY ?? 50))),
      scale: Math.min(2, Math.max(.5, Number(context?.background?.scale ?? 1))),
    },
    lines: toLyrics(context?.lines),
    lyricColors: context.lyricsUi,
  };
}

export function toLyrics(lines) {
  const source = (Array.isArray(lines) ? lines : [])
    .filter((line) => Number.isFinite(Number(line?.time)) && text(line?.text))
    .sort((a, b) => Number(a.time) - Number(b.time));
  let karaokeLines = 0;
  const mapped = source.map((line, index) => {
    const lineText = text(line.text).replace(/\s+/g, ' ');
    const nextTime = Number(source[index + 1]?.time);
    const duration = Math.max(0.08, Number.isFinite(nextTime) ? nextTime - Number(line.time) : 6);
    let characterOffset = 0;
    const words = (Array.isArray(line.words) ? line.words : []).flatMap((word) => {
      const wordText = text(word?.text);
      if (!wordText) return [];
      const start = Math.max(0, Number(word.time) || Number(line.time));
      const wordDuration = Math.max(0.06, Number(word.duration) || 0.12);
      const c0 = characterOffset;
      characterOffset += [...wordText].length;
      return [{ text: wordText, t: start, d: wordDuration, c0, c1: characterOffset }];
    });
    if (words.length > 1) karaokeLines += 1;
    return {
      t: Math.max(0, Number(line.time) || 0),
      duration,
      text: lineText,
      words: words.length > 1 ? words : undefined,
      charCount: Math.max(1, [...lineText].length),
      source: words.length > 1 ? 'mono-word' : 'mono-line',
    };
  });
  const karaoke = karaokeLines > 0 && karaokeLines >= Math.ceil(mapped.length * 0.3);
  return { lines: mapped, karaoke, timingSource: karaoke ? 'mono-word' : (mapped.length ? 'mono-line' : 'none') };
}

export function contextKey(context) {
  const track = context?.activeTrack;
  return [track?.id, track?.path, artwork(track)].map((value) => text(value)).join('|');
}
