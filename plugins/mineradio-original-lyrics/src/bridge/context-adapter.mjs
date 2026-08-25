const text = (value, fallback = '') => String(value ?? fallback).trim();

export function mergeContext(current, next) {
  const previous = current || {};
  const incoming = next || {};
  const hasTrack = Object.prototype.hasOwnProperty.call(incoming, 'activeTrack');
  const oldTrack = previous.activeTrack;
  const newTrack = incoming.activeTrack;
  const sameTrack = oldTrack && newTrack
    && text(oldTrack.id ?? oldTrack.path) === text(newTrack.id ?? newTrack.path);
  return {
    ...previous,
    ...incoming,
    activeTrack: hasTrack
      ? (newTrack ? { ...(sameTrack ? oldTrack : {}), ...newTrack } : null)
      : oldTrack,
    config: { ...(previous.config || {}), ...(incoming.config || {}) },
  };
}

export function artwork(track, fallback = '') {
  return text(
    track?.artworkDataUrl
      || track?.associatedArtwork
      || track?.artwork
      || track?.cover
      || track?.picUrl
      || fallback,
  );
}

function artist(track, fallback = '') {
  if (Array.isArray(track?.artist)) return track.artist.filter(Boolean).join(' / ');
  return text(track?.artist, fallback);
}

function durationSeconds(track, fallback = 0) {
  const value = Number(track?.duration ?? track?.durationMs ?? fallback) || 0;
  return value > 1000 ? value / 1000 : value;
}

export function toSong(track, fallback = {}) {
  if (!track) return null;
  return {
    id: text(track.id ?? track.path ?? `${track.title || ''}|${track.artist || ''}`),
    name: text(track.title ?? track.name, fallback.title || '未在播放'),
    title: text(track.title ?? track.name, fallback.title || '未在播放'),
    artist: artist(track, fallback.artist),
    album: text(track.album, fallback.album),
    cover: artwork(track, fallback.coverUrl),
    duration: durationSeconds(track, fallback.duration),
    source: 'local',
    provider: 'local',
    type: 'local',
  };
}

export function toRuntimeContext(context) {
  const activeSong = toSong(context?.activeTrack, context || {});
  const queue = (Array.isArray(context?.queueTracks) ? context.queueTracks : [])
    .map((track) => toSong(track, context || {}))
    .filter(Boolean);
  if (activeSong && !queue.some((song) => song.id === activeSong.id)) queue.unshift(activeSong);
  const activeIndex = activeSong ? Math.max(0, queue.findIndex((song) => song.id === activeSong.id)) : -1;
  return {
    track: activeSong,
    queue,
    activeIndex,
    currentTime: Math.max(0, Number(context?.currentTime) || 0),
    duration: Math.max(0, Number(context?.duration) || activeSong?.duration || 0),
    playing: Boolean(context?.isPlaying),
    favorite: Boolean(context?.isFavorite),
    muted: Boolean(context?.isMuted),
    volume: Math.min(1, Math.max(0, (Number(context?.volume) || 0) > 1 ? Number(context.volume) / 100 : Number(context?.volume) || 0)),
    playbackRate: Math.max(0.25, Number(context?.playbackRate) || 1),
    playbackMode: text(context?.playbackMode, 'fixed'),
    lines: toLyrics(context?.lines),
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
  return [track?.id, track?.path, artwork(track, context?.coverUrl)].map((value) => text(value)).join('|');
}
