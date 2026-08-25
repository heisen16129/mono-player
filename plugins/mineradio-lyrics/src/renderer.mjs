import { createMineradioEngine } from './vendor/mineradio/engine.js';
import mineradioCss from './vendor/mineradio/mineradio.css';
import skullPointsQuantizedUrl from './vendor/mineradio/skull-decimation-points.q16';
import shellCss from './ui/plugin-shell.css';
import {
  applyContextConfig,
  lyricsKey,
  mergeRendererContext,
  persistedFxConfig,
  toMineradioLyrics,
  toMineradioTrack,
  trackKey,
} from './bridge/context-adapter.mjs';
import { createShell } from './ui/shell.mjs';

let target = null;
let rendererApi = null;
let shell = null;
let engine = null;
let context = {};
let currentTrackKey = null;
let currentLyricsKey = null;
let currentConfigKey = null;
let persistTimer = 0;
let applyingConfig = false;
let skullPointsBlobUrl = '';

const playbackClock = {
  currentTime: 0,
  duration: 0,
  paused: true,
  playbackRate: 1,
  currentSrc: '',
  src: '',
};

function configKey(config) {
  try { return JSON.stringify(config || {}); } catch { return ''; }
}

function scheduleConfigPersist() {
  if (applyingConfig || !engine || !rendererApi) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    if (!engine || !rendererApi) return;
    rendererApi.post('updateConfig', { config: persistedFxConfig(engine.getState().fx) });
  }, 120);
}

async function decodeSkullPoints() {
  const buffer = await fetch(skullPointsQuantizedUrl).then((response) => response.arrayBuffer());
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const length = view.getUint32(4, true);
  if (magic !== 'MRQ1' || buffer.byteLength !== 48 + length * 2) throw new Error('Invalid Mineradio skull asset.');
  const mins = Array.from({ length: 5 }, (_, channel) => view.getFloat32(8 + channel * 4, true));
  const ranges = Array.from({ length: 5 }, (_, channel) => view.getFloat32(28 + channel * 4, true));
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const channel = index % 5;
    output[index] = mins[channel] + (view.getUint16(48 + index * 2, true) / 65535) * ranges[channel];
  }
  return URL.createObjectURL(new Blob([output.buffer], { type: 'application/octet-stream' }));
}

function updateEngine(nextContext) {
  context = mergeRendererContext(context, nextContext);
  if (!engine || !shell) return;
  const nextTrackKey = trackKey(context);
  if (nextTrackKey !== currentTrackKey) {
    currentTrackKey = nextTrackKey;
    engine.setTrack(toMineradioTrack(context));
    currentLyricsKey = null;
  }
  const nextLyricsKey = lyricsKey(context.lines);
  if (nextLyricsKey !== currentLyricsKey) {
    currentLyricsKey = nextLyricsKey;
    const lyrics = toMineradioLyrics(context.lines);
    engine.setLyrics(lyrics.lines, lyrics);
  }
  engine.setPlaybackState({
    currentTime: Math.max(0, Number(context.currentTime) + Number(context.lyricTimeOffset || 0)),
    duration: Math.max(0, Number(context.duration) || 0),
    playbackRate: Math.max(0.25, Number(context.playbackRate) || 1),
    playing: Boolean(context.isPlaying),
  });
  engine.setPlaying(Boolean(context.isPlaying));
  const nextConfigKey = configKey(context.config);
  if (nextConfigKey !== currentConfigKey) {
    currentConfigKey = nextConfigKey;
    applyingConfig = true;
    applyContextConfig(engine, context.config);
    applyingConfig = false;
  }
  shell.render(context);
  target.dataset.mineradioEngine = JSON.stringify(engine.debug());
}

async function mount(nextTarget, initialContext, api) {
  target = nextTarget;
  rendererApi = api;
  context = initialContext || {};
  const style = document.createElement('style');
  style.dataset.mineradioPluginStyles = 'true';
  style.textContent = `${mineradioCss}\n${shellCss}`;
  document.head.append(style);
  shell = createShell(target, rendererApi, () => engine);
  try {
    skullPointsBlobUrl = await decodeSkullPoints();
  } catch (error) {
    console.warn('[Mineradio] skull asset decode failed', error);
  }
  engine = createMineradioEngine({
    canvasContainer: shell.canvasContainer,
    albumBg: shell.albumBg,
    overlayRoot: shell.root,
    audio: playbackClock,
    assets: { 'skull-decimation-points.bin': skullPointsBlobUrl },
    toast: (message) => console.info('[Mineradio]', message),
    onFxChange: () => {
      shell?.renderFx();
      scheduleConfigPersist();
    },
    onBeatChip: (state) => shell?.setBeatChip(state),
    onImmersiveChange: (on) => shell?.setImmersive(on),
  });
  updateEngine(context);
}

function destroy() {
  clearTimeout(persistTimer);
  engine?.destroy();
  shell?.destroy();
  document.querySelector('style[data-mineradio-plugin-styles="true"]')?.remove();
  if (skullPointsBlobUrl) URL.revokeObjectURL(skullPointsBlobUrl);
  target = null;
  rendererApi = null;
  shell = null;
  engine = null;
  context = {};
  currentTrackKey = null;
  currentLyricsKey = null;
  currentConfigKey = null;
  skullPointsBlobUrl = '';
  playbackClock.currentTime = 0;
  playbackClock.duration = 0;
  playbackClock.paused = true;
}

export default {
  mount,
  update(nextContext) { updateEngine(nextContext || {}); },
  updateAudioSpectrum(levels) { engine?.setAudioSpectrum(Array.isArray(levels) ? levels : []); },
  destroy,
};
