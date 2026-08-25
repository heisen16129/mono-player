const PRESET_IDS = {
  cover: 0,
  roller: 1,
  planet: 2,
  void: 3,
  record: 4,
  river: 5,
  skull: 6,
};

const PERSISTED_FX_KEYS = [
  'preset', 'intensity', 'cinemaShake', 'depth', 'coverResolution', 'point', 'speed',
  'twist', 'color', 'scatter', 'bgFade', 'bloomStrength', 'lyricGlowStrength',
  'lyricScale', 'lyricOffsetX', 'lyricOffsetY', 'lyricOffsetZ', 'lyricTiltX',
  'lyricTiltY', 'lyricColorMode', 'lyricColor', 'lyricHighlightMode',
  'lyricHighlightColor', 'lyricGlowLinked', 'lyricGlowColor', 'lyricFont',
  'lyricLetterSpacing', 'lyricLineHeight', 'lyricWeight', 'visualTintMode',
  'visualTintColor', 'uiAccentColor', 'backgroundColorMode', 'backgroundColor',
  'backgroundOpacity', 'controlGlassChromaticOffset', 'floatLayer', 'cinema', 'edge',
  'aiDepth', 'bloom', 'lyricGlow', 'lyricGlowBeat', 'lyricGlowParticles',
  'lyricCameraLock', 'particleLyrics', 'performanceBackground', 'performanceQuality',
];

const TOGGLE_FX_KEYS = [
  'floatLayer', 'cinema', 'edge', 'aiDepth', 'bloom', 'lyricGlow', 'lyricGlowBeat',
  'lyricGlowParticles', 'lyricCameraLock', 'particleLyrics',
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export function artistText(track, fallback = '') {
  if (Array.isArray(track?.artist)) return track.artist.filter(Boolean).join(' / ');
  return String(track?.artist || fallback || '');
}

export function trackArtworkDisplayUrl(track) {
  const artwork = String(
    track?.associatedArtwork
      || track?.artwork
      || track?.cover
      || track?.picUrl
      || '',
  ).trim();
  if (!artwork.toLowerCase().startsWith('file:///')) return artwork;
  return `http://asset.localhost/${encodeURIComponent(artwork.replace(/^file:\/\/\//i, ''))}`;
}

export function artworkUrl(context) {
  const track = context?.activeTrack;
  return String(
    track?.artworkDataUrl
      || context?.coverUrl
      || track?.associatedArtwork
      || track?.artwork
      || track?.cover
      || track?.picUrl
      || '',
  );
}

export function mergeRendererContext(currentContext, nextContext) {
  const current = currentContext || {};
  const next = nextContext || {};
  const previousTrack = current.activeTrack;
  const nextTrack = next.activeTrack;
  const hasNextTrack = Object.prototype.hasOwnProperty.call(next, 'activeTrack');
  const sameTrack = previousTrack && nextTrack
    && String(previousTrack.id ?? previousTrack.path ?? '') === String(nextTrack.id ?? nextTrack.path ?? '');
  return {
    ...current,
    ...next,
    activeTrack: hasNextTrack
      ? (nextTrack ? { ...(sameTrack ? previousTrack : {}), ...nextTrack } : null)
      : previousTrack,
    config: { ...(current.config || {}), ...(next.config || {}) },
  };
}

export function trackKey(context) {
  const track = context?.activeTrack;
  if (!track) return '';
  return [track.id, track.path, track.sourceProviderId, artworkUrl(context)].map((value) => String(value || '')).join('|');
}

export function toMineradioTrack(context) {
  const track = context?.activeTrack;
  if (!track) return null;
  return {
    id: String(track.id ?? track.path ?? ''),
    name: String(track.title || context.title || '未在播放'),
    artist: artistText(track, context.artist),
    album: String(track.album || context.album || ''),
    cover: artworkUrl(context),
    platform: String(track.sourceProviderId || track.sourceName || 'mono'),
  };
}

export function lyricsKey(lines) {
  if (!Array.isArray(lines) || !lines.length) return '';
  const first = lines[0];
  const last = lines[lines.length - 1];
  const wordCount = lines.reduce((sum, line) => sum + (line.words?.length || 0), 0);
  return `${lines.length}|${wordCount}|${first?.time ?? ''}|${first?.text ?? ''}|${last?.time ?? ''}|${last?.text ?? ''}`;
}

export function toMineradioLyrics(inputLines) {
  const sourceLines = Array.isArray(inputLines) ? inputLines : [];
  const timed = sourceLines
    .filter((line) => Number.isFinite(Number(line?.time)) && String(line?.text || '').trim())
    .map((line) => ({ ...line, time: Math.max(0, Number(line.time)) }))
    .sort((a, b) => a.time - b.time);
  let karaokeLines = 0;
  const lines = timed.map((line, lineIndex) => {
    const next = timed[lineIndex + 1];
    const text = String(line.text || '').replace(/\s+/g, ' ').trim();
    const duration = Math.max(0.08, next ? next.time - line.time : 6);
    let cursor = 0;
    const words = (line.words || []).flatMap((word) => {
      const wordText = String(word?.text || '');
      if (!wordText) return [];
      const start = Math.max(0, Number(word.time) || line.time);
      const wordDuration = Math.max(0.06, Number(word.duration) || 0.12);
      const c0 = cursor;
      cursor += wordText.length;
      return [{ text: wordText, t: start, d: wordDuration, c0, c1: cursor }];
    });
    const hasWordTiming = words.length > 1;
    if (hasWordTiming) karaokeLines += 1;
    return {
      t: line.time,
      duration,
      text,
      words: hasWordTiming ? words : undefined,
      charCount: Math.max(1, text.length),
      source: hasWordTiming ? 'mono-word' : 'mono-line',
    };
  });
  const hasKaraoke = karaokeLines > 0 && karaokeLines >= Math.ceil(lines.length * 0.3);
  return { lines, hasKaraoke, timingSource: hasKaraoke ? 'mono-word' : (lines.length ? 'mono-line' : 'none') };
}

export function applyContextConfig(engine, config = {}) {
  if (!engine) return;
  const state = engine.getState();
  const directPreset = Number(config.preset);
  const preset = Number.isInteger(directPreset)
    ? clamp(directPreset, 0, 6)
    : PRESET_IDS[String(config.visualPreset || '')];
  if (Number.isInteger(preset) && preset !== state.fx.preset) engine.setPreset(preset);

  const mapped = {
    intensity: config.intensity ?? (config.motion != null ? 0.2 + clamp(config.motion, 0, 100) * 0.014 : undefined),
    cinemaShake: config.cinemaShake ?? (config.motion != null ? clamp(config.motion, 0, 100) * 0.018 : undefined),
    depth: config.depth != null && Number(config.depth) > 2 ? 0.2 + clamp(config.depth, 0, 100) * 0.016 : config.depth,
    point: config.point ?? (config.particleSize != null ? 0.5 + clamp(config.particleSize, 0, 100) * 0.017 : undefined),
    lyricGlowStrength: config.lyricGlowStrength ?? (config.glow != null ? clamp(config.glow, 0, 100) * 0.0085 : undefined),
    lyricScale: config.lyricScale != null && Number(config.lyricScale) > 2 ? 0.35 + clamp(config.lyricScale, 0, 100) * 0.013 : config.lyricScale,
  };
  for (const key of PERSISTED_FX_KEYS) {
    if (key === 'preset') continue;
    const value = mapped[key] ?? config[key];
    if (typeof value === 'number' && Number.isFinite(value) && value !== state.fx[key]) engine.setFxValue(key, value);
  }
  for (const key of TOGGLE_FX_KEYS) {
    if (typeof config[key] === 'boolean' && config[key] !== Boolean(engine.getState().fx[key])) engine.toggleFx(key);
  }
  if (config.particleLyrics == null && typeof config.showLyrics === 'boolean' && config.showLyrics !== Boolean(engine.getState().fx.particleLyrics)) engine.toggleLyrics();
  if (config.cinema == null && typeof config.autoRotate === 'boolean' && config.autoRotate !== Boolean(engine.getState().fx.cinema)) engine.toggleFx('cinema');
  if (typeof config.lyricFont === 'string') engine.setLyricFont(config.lyricFont);
  if (config.lyricColorMode === 'auto') engine.setLyricColorAuto();
  else if (/^#[0-9a-f]{6}$/i.test(String(config.lyricColor || ''))) engine.setLyricColorCustom(String(config.lyricColor));
  if (config.lyricHighlightMode === 'auto') engine.setLyricHighlightAuto();
  else if (/^#[0-9a-f]{6}$/i.test(String(config.lyricHighlightColor || ''))) engine.setLyricHighlightCustom(String(config.lyricHighlightColor));
  if (typeof config.lyricGlowLinked === 'boolean') engine.setLyricGlowLinked(config.lyricGlowLinked);
  if (!config.lyricGlowLinked && /^#[0-9a-f]{6}$/i.test(String(config.lyricGlowColor || ''))) engine.setLyricGlowCustom(String(config.lyricGlowColor));
  if (/^#[0-9a-f]{6}$/i.test(String(config.uiAccentColor || ''))) engine.setUiAccentColor(String(config.uiAccentColor));
  if (config.visualTintMode === 'auto') engine.setVisualTintAuto();
  else if (/^#[0-9a-f]{6}$/i.test(String(config.visualTintColor || config.visualTint || ''))) engine.setVisualTintCustom(String(config.visualTintColor || config.visualTint));
  if (config.backgroundColorMode === 'cover') engine.setCustomBackgroundCoverMode();
  else if (/^#[0-9a-f]{6}$/i.test(String(config.backgroundColor || ''))) engine.setCustomBackgroundColor(String(config.backgroundColor));
  if (['auto', 'keep', 'release'].includes(config.performanceBackground)) engine.setPerformanceBackgroundMode(config.performanceBackground);
  if (['eco', 'balanced', 'high', 'ultra'].includes(config.performanceQuality)) engine.setPerformanceQualityMode(config.performanceQuality);
  else if (config.reducedFx === true) engine.setPerformanceQualityMode('eco');
}

export function persistedFxConfig(fx) {
  const config = {};
  for (const key of PERSISTED_FX_KEYS) {
    const value = fx?.[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) config[key] = value;
  }
  return config;
}
