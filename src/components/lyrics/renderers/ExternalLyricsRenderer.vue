<script setup lang="ts">
import { useLyricsColors } from '../../../composables/useLyricsColors';
import { useLyricsRendererSettings } from '../../../composables/useLyricsRendererSettings';
const lyricColors = useLyricsColors();
const { selectLyricsRenderer } = useLyricsRendererSettings();
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useWindowDrag } from '../../../composables/useWindowDrag';
import { invokeApi } from '../../../services/api';
import { readArtworkFile } from '../../../services/music';
import { listenRustBackendAudioFrame, type RustAudioFrame } from '../../../services/playerBackend';
import type {
  ExternalLyricsRendererHostMessage,
  ExternalLyricsRendererTrack,
  LyricsRendererContext,
} from '../../../types/lyricsRenderer';
import type { Track } from '../../../types/music';
import type { PluginPermission } from '../../../types/plugin';
import type { PlayerDockController } from '../../../types/playerDockController';
import { artworkBlobDataUrl, artworkDisplaySrc, artworkUrlDataUrl, trackArtworkSource } from '../../../utils/artwork';
import LyricsRendererSearchOverlay from '../LyricsRendererSearchOverlay.vue';

const props = defineProps<{
  entry: string;
  wasmPlugin?: { id: string; permissions: PluginPermission[] };
  manifestPath?: string;
  context: LyricsRendererContext;
  playerDockController?: PlayerDockController | null;
}>();

const frame = ref<HTMLIFrameElement | null>(null);
const { startWindowDrag } = useWindowDrag();
const sandboxEntry = ref('');
const sandboxModuleSource = ref<string | null>(null);
const loadError = ref('');
let loadGeneration = 0;
let unlistenAudioFrame: (() => void) | null = null;
let latestAudioFrame: RustAudioFrame | null = null;
let audioFrameDisposed = false;
const artworkDataUrlCache = new Map<string, Promise<string>>();
const activeArtworkDataUrl = ref('');
let activeArtworkIdentity = '';
let artworkLoadGeneration = 0;

function trackKey(track: Track | null | undefined) {
  if (!track) return '';
  return `${track.id}:${track.path}`;
}

function serializableTrack(track: Track | null | undefined): ExternalLyricsRendererTrack | null {
  if (!track) return null;
  return {
    id: track.id,
    path: track.path,
    title: track.title,
    artist: Array.isArray(track.artist) ? [...track.artist] : null,
    album: track.album,
    duration: track.duration,
    coverVersion: track.coverVersion,
    artwork: track.artwork,
    associatedArtwork: track.associatedArtwork,
    sourceId: track.sourceId,
    sourceName: track.sourceName,
    sourceProviderId: track.sourceProviderId,
  };
}

function cachedArtworkDataUrl(reference: string) {
  if (/^data:image\//i.test(reference)) return Promise.resolve(reference);
  const cached = artworkDataUrlCache.get(reference);
  if (cached) return cached;
  if (artworkDataUrlCache.size >= 8) {
    const oldestKey = artworkDataUrlCache.keys().next().value;
    if (oldestKey) artworkDataUrlCache.delete(oldestKey);
  }
  const pending = (async () => {
    if (/^file:\/\//i.test(reference)) {
      const cover = await readArtworkFile(reference);
      if (!cover?.data.length) throw new Error('已缓存的封面文件不存在');
      return artworkBlobDataUrl(new Blob(
        [new Uint8Array(cover.data)],
        { type: cover.mime_type },
      ));
    }
    return artworkUrlDataUrl(artworkDisplaySrc(reference));
  })().catch((error) => {
    artworkDataUrlCache.delete(reference);
    throw error;
  });
  artworkDataUrlCache.set(reference, pending);
  return pending;
}

function activeArtworkReference(activeTrack: Track, displayCoverUrl: string) {
  const matchingTrackArtwork = [activeTrack.associatedArtwork, activeTrack.artwork]
    .find((artwork) => artwork && artworkDisplaySrc(artwork) === displayCoverUrl);
  return matchingTrackArtwork || displayCoverUrl || trackArtworkSource(activeTrack) || '';
}

async function refreshActiveArtworkDataUrl() {
  const generation = ++artworkLoadGeneration;
  activeArtworkDataUrl.value = '';
  activeArtworkIdentity = '';
  const activeTrack = props.playerDockController?.playbackMetaControlProps.value.activeTrack;
  postTrackContext();
  if (!activeTrack) return;
  const reference = activeArtworkReference(activeTrack, String(props.context.coverUrl || '').trim());
  if (!reference) return;
  const identity = `${trackKey(activeTrack)}:${reference}`;
  try {
    const dataUrl = await cachedArtworkDataUrl(reference);
    if (generation !== artworkLoadGeneration) return;
    activeArtworkDataUrl.value = dataUrl;
    activeArtworkIdentity = identity;
    postTrackContext();
  } catch (error) {
    if (generation === artworkLoadGeneration) activeArtworkDataUrl.value = '';
    console.warn('[歌词插件宿主][封面] 转换 Base64 失败', {
      曲目编号: activeTrack.id,
      歌曲名: activeTrack.title,
      封面来源: artworkDisplaySrc(reference),
      错误信息: error instanceof Error ? error.message : String(error),
    });
  }
}

async function loadSandboxEntry() {
  const generation = ++loadGeneration;
  loadError.value = '';
  sandboxEntry.value = '';
  sandboxModuleSource.value = null;
  if (/^(data:|blob:)/i.test(props.entry)) {
    sandboxEntry.value = props.entry;
    return;
  }
  const remote = /^https?:/i.test(props.entry);
  if (!remote && !props.manifestPath && !props.wasmPlugin) {
    loadError.value = '插件缺少本地 manifest 路径。';
    selectLyricsRenderer('classic');
    return;
  }
  try {
    let wasmSource: string | undefined;
    if (props.wasmPlugin) {
      const payload = await invokeApi<{ apiVersion: number; source: string }>('plugin_invoke', {
        entry: props.entry, request: { action: 'renderer' }, pluginId: props.wasmPlugin.id,
        permissions: props.wasmPlugin.permissions,
      });
      if (payload.apiVersion !== 1 || typeof payload.source !== 'string' || !payload.source.trim()) {
        throw new Error('WASM 歌词插件返回了无效的页面');
      }
      wasmSource = payload.source;
    }
    const source = wasmSource ?? (remote
      ? await invokeApi<string>('read_remote_renderer_module', { url: props.entry })
      : await invokeApi<string>('read_local_renderer_module', {
      manifestPath: props.manifestPath,
      modulePath: props.entry,
    }));
    if (generation !== loadGeneration) return;
    sandboxModuleSource.value = source;
    sandboxEntry.value = 'local-module';
  } catch (error) {
    if (generation !== loadGeneration) return;
    loadError.value = error instanceof Error ? error.message : String(error);
    console.error('[LyricsRenderer] 加载失败，回退经典歌词', error);
    selectLyricsRenderer('classic');
  }
}

function createSandboxDocument(entry: string) {
  const serializedEntry = JSON.stringify(entry).replace(/</g, '\\u003c');
  const serializedSource = JSON.stringify(sandboxModuleSource.value).replace(/</g, '\\u003c');
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent!important;color-scheme:normal!important}</style><script>
const entry=${serializedEntry};const source=${serializedSource};const contextMessageTypes=new Set(['track','lyrics','queue','background','config','playback','lyrics-ui']);const pendingMessages=new Map();const pendingOrder=['track','lyrics','queue','background','config','playback','lyrics-ui'];let renderer=null;let rendererReady=false;let moduleUrl=entry;let latestAudioFrame=null;let currentTrackKey='';let api={post:(action,payload,requestId)=>parent.postMessage({type:'lyrics-renderer-action',action,payload,requestId},'*')};
async function deliver(message){if(message.type==='track'){currentTrackKey=String(message.trackKey||'');const pendingLyrics=pendingMessages.get('lyrics');if(pendingLyrics&&String(pendingLyrics.trackKey||'')!==currentTrackKey)pendingMessages.delete('lyrics')}if(message.type==='lyrics'&&String(message.trackKey||'')!==currentTrackKey)return;if(rendererReady&&renderer?.update)await renderer.update(message);else pendingMessages.set(message.type,message)}
async function deliverPending(){if(!rendererReady||!renderer?.update)return;for(const type of pendingOrder){const message=pendingMessages.get(type);if(!message)continue;pendingMessages.delete(type);await deliver(message)}}
window.addEventListener('message',async(event)=>{if(event.source!==parent)return;const message=event.data||{};try{if(message.type==='init'){rendererReady=false;pendingMessages.clear();currentTrackKey='';if(source!==null)moduleUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));const loaded=await import(moduleUrl);renderer=loaded.default||loaded;if(typeof renderer.mount!=='function'||typeof renderer.update!=='function')throw new Error('Renderer must export mount(root, api) and update(message)');await renderer.mount(document.body,api);rendererReady=true;if(typeof renderer.updateAudioFrame==='function')parent.postMessage({type:'lyrics-renderer-audio-frame-subscribe'},'*');await deliverPending();if(latestAudioFrame&&renderer.updateAudioFrame)renderer.updateAudioFrame(latestAudioFrame)}else if(contextMessageTypes.has(message.type)){await deliver(message)}else if(message.type==='audio-frame'){latestAudioFrame=message.frame||null;if(rendererReady&&renderer?.updateAudioFrame)renderer.updateAudioFrame(latestAudioFrame)}else if(message.type==='lyrics-renderer-action-result'&&String(message.requestId||'').includes('playback-')){console.log('[歌词插件通信桥][播放控制] 执行结果',{请求编号:message.requestId,是否成功:message.ok,错误信息:message.message||''})}}catch(error){parent.postMessage({type:'lyrics-renderer-error',message:String(error)},'*')}});
window.addEventListener('pagehide',()=>{try{renderer?.destroy?.()}catch{}if(source!==null&&String(moduleUrl).startsWith('blob:'))URL.revokeObjectURL(moduleUrl)},{once:true});
<\/script>`;
}

function lyricsPayload() {
  return props.context.lines.map((line) => ({
    time: typeof line.time === 'number' ? line.time : null,
    text: String(line.text ?? ''),
    ...(line.words
      ? {
          words: line.words.map((word) => ({
            time: Number(word.time) || 0,
            duration: typeof word.duration === 'number' ? word.duration : null,
            text: String(word.text ?? ''),
          })),
        }
      : {}),
  }));
}

function configPayload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const config: Record<string, string | number | boolean | string[] | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!key || key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item === null) {
      config[key] = item;
    } else if (Array.isArray(item) && item.every((entry) => typeof entry === 'string')) {
      config[key] = item;
    }
  }
  return config;
}

function postHostMessage(message: ExternalLyricsRendererHostMessage) {
  try {
    frame.value?.contentWindow?.postMessage(message, '*');
  } catch (error) {
    loadError.value = `歌词插件通信失败：${error instanceof Error ? error.message : String(error)}`;
  }
}

function postTrackContext() {
  const sourceTrack = props.playerDockController?.playbackMetaControlProps.value.activeTrack;
  const activeTrack = serializableTrack(sourceTrack);
  if (sourceTrack && activeTrack && activeArtworkDataUrl.value) {
    const reference = activeArtworkReference(sourceTrack, String(props.context.coverUrl || '').trim());
    if (activeArtworkIdentity === `${trackKey(sourceTrack)}:${reference}`) {
      activeTrack.artworkDataUrl = activeArtworkDataUrl.value;
    }
  }
  postHostMessage({ type: 'track', trackKey: trackKey(sourceTrack), activeTrack });
}

function postLyricsContext() {
  const activeTrack = props.playerDockController?.playbackMetaControlProps.value.activeTrack;
  postHostMessage({ type: 'lyrics', trackKey: trackKey(activeTrack), lines: lyricsPayload() });
}

function postQueueContext() {
  const queueTracks = props.playerDockController?.playbackMetaControlProps.value.queueTracks ?? [];
  postHostMessage({
    type: 'queue',
    queueTracks: queueTracks
      .map((track) => serializableTrack(track))
      .filter((track): track is ExternalLyricsRendererTrack => track !== null),
  });
}

function postBackgroundContext() {
  postHostMessage({ type: 'background', background: { ...props.context.background } });
}

function postConfigContext() {
  postHostMessage({ type: 'config', config: configPayload(props.context.config) ?? {} });
}

function postPlaybackContext() {
  const meta = props.playerDockController?.playbackMetaControlProps.value;
  const transport = props.playerDockController?.transportControlProps.value;
  postHostMessage({
    type: 'playback',
    playback: {
      currentTime: props.context.currentTime,
      isPlaying: props.context.isPlaying,
      isFavorite: props.context.isFavorite,
      volume: meta?.volume ?? props.context.volume,
      isMuted: meta?.isMuted ?? false,
      playbackRate: meta?.playbackRate ?? 1,
      playbackMode: transport?.playbackMode ?? 'fixed',
      playbackModeLabel: transport?.playbackModeLabel ?? '',
    },
  });
}

function postLyricsUiContext() {
  const meta = props.playerDockController?.playbackMetaControlProps.value;
  postHostMessage({
    type: 'lyrics-ui',
    lyricsUi: {
      activeLyricIndex: props.context.activeLyricIndex,
      lyricTimeOffset: props.context.lyricTimeOffset,
      fontSize: props.context.fontSize,
      lyricColor: lyricColors.base.value,
      lyricHighlightColor: lyricColors.highlight.value,
      lyricGlowColor: lyricColors.glow.value,
      useThemeLyricColor: false,
      isLoading: props.context.isLoading,
      loadingText: props.context.loadingText,
      emptyMessage: props.context.emptyMessage,
      locale: meta?.locale ?? 'zh-CN',
    },
  });
}

function postInitialContext() {
  postTrackContext();
  postLyricsContext();
  postQueueContext();
  postBackgroundContext();
  postConfigContext();
  postPlaybackContext();
  postLyricsUiContext();
}

function postAudioFrame(audioFrame: RustAudioFrame) {
  latestAudioFrame = audioFrame;
  const samples = Float32Array.from(audioFrame.samples);
  frame.value?.contentWindow?.postMessage({
    type: 'audio-frame',
    frame: {
      sequence: audioFrame.sequence,
      sampleRate: audioFrame.sampleRate,
      channels: audioFrame.channels,
      samples,
    },
  }, '*', [samples.buffer]);
}

async function startAudioFrameBridge() {
  const unlisten = await listenRustBackendAudioFrame(postAudioFrame);
  if (audioFrameDisposed) {
    unlisten();
    return;
  }
  unlistenAudioFrame = unlisten;
}

function postActionResult(requestId: unknown, ok: boolean, error?: unknown) {
  if (typeof requestId !== 'string' || !frame.value?.contentWindow) return;
  frame.value.contentWindow.postMessage({
    type: 'lyrics-renderer-action-result',
    requestId,
    ok,
    ...(error ? { message: error instanceof Error ? error.message : String(error) } : {}),
  }, '*');
}

async function handleMessage(event: MessageEvent) {
  if (event.source !== frame.value?.contentWindow) return;
  const message = event.data || {};
  if (message.type === 'lyrics-renderer-error') {
    loadError.value = `歌词插件运行失败：${String(message.message || '未知错误')}`;
    console.error(loadError.value);
    selectLyricsRenderer('classic');
    return;
  }
  if (message.type === 'lyrics-renderer-audio-frame-subscribe') {
    void startAudioFrameBridge();
    return;
  }
  if (message.type !== 'lyrics-renderer-action') return;
  const isPlaybackToggle = message.action === 'togglePlayback';
  const playbackStartedAt = performance.now();
  if (isPlaybackToggle) {
    const playbackMeta = props.playerDockController?.playbackMetaControlProps.value;
    console.log('[歌词插件宿主][播放控制] 已接收', {
      请求编号: message.requestId ?? null,
      插件看到的播放状态: message.payload?.observedPlaying,
      宿主当前播放状态: playbackMeta?.isPlaying ?? props.context.isPlaying,
      曲目编号: playbackMeta?.activeTrack?.id ?? null,
      歌曲名: playbackMeta?.activeTrack?.title ?? props.context.title ?? '',
    });
  }
  try {
    if (message.action === 'seek' && Number.isInteger(message.payload?.lineIndex)) {
      const line = props.context.lines[message.payload.lineIndex];
      if (line) await props.context.seek(line);
    } else if (message.action === 'openSearch') await props.context.openSearch();
    else if (message.action === 'openSettings') await props.context.actionMenu.openSettings();
    else if (message.action === 'beginBrowse') await props.context.beginBrowse();
    else if (message.action === 'restoreRealtime') await props.context.restoreRealtime();
    else if (message.action === 'shiftTiming') await props.context.shiftTiming(Number(message.payload?.deltaSeconds) || 0);
    else if (message.action === 'close') await props.context.close();
    else if (message.action === 'togglePlayback') {
      if (props.playerDockController) await props.playerDockController.togglePlayback();
      else await props.context.togglePlayback();
    }
    else if (message.action === 'playNext') await props.context.playNext();
    else if (message.action === 'playPrevious') await props.context.playPrevious();
    else if (message.action === 'toggleFavorite') await props.context.toggleFavorite();
    else if (message.action === 'coverError') await props.context.coverError();
    else if (message.action === 'seekTime' && Number.isFinite(Number(message.payload?.time))) await props.context.seekToTime(Number(message.payload.time));
    else if (message.action === 'setVolume' && Number.isFinite(Number(message.payload?.value))) {
      const value = Number(message.payload.value);
      if (props.playerDockController) props.playerDockController.changeVolume(value);
      else props.context.setVolume(value);
    }
    else if (message.action === 'toggleMute') await props.playerDockController?.toggleMute();
    else if (message.action === 'togglePlaybackMode') await props.playerDockController?.requestPlaybackModeToggle();
    else if (message.action === 'setPlaybackRate' && Number.isFinite(Number(message.payload?.value))) {
      await props.playerDockController?.changePlaybackRate(Number(message.payload.value));
    } else if (message.action === 'playQueueTrack' && Number.isInteger(message.payload?.index)) {
      const track = props.playerDockController?.playbackMetaControlProps.value.queueTracks[message.payload.index];
      if (track) await props.playerDockController?.playQueueTrack(track);
    } else if (message.action === 'updateConfig') {
      const config = configPayload(message.payload?.config);
      if (config) await props.context.updateConfig(config);
    }
    else return;
    if (isPlaybackToggle) {
      const playbackMeta = props.playerDockController?.playbackMetaControlProps.value;
      console.log('[歌词插件宿主][播放控制] 执行完成', {
        请求编号: message.requestId ?? null,
        耗时毫秒: Math.round((performance.now() - playbackStartedAt) * 10) / 10,
        宿主当前播放状态: playbackMeta?.isPlaying ?? props.context.isPlaying,
      });
    }
    postActionResult(message.requestId, true);
  } catch (error) {
    if (isPlaybackToggle) {
      console.error('[歌词插件宿主][播放控制] 执行失败', {
        请求编号: message.requestId ?? null,
        耗时毫秒: Math.round((performance.now() - playbackStartedAt) * 10) / 10,
        错误: error,
      });
    }
    postActionResult(message.requestId, false, error);
    loadError.value = `歌词插件动作失败：${error instanceof Error ? error.message : String(error)}`;
  }
}

function handleLoad() {
  loadError.value = '';
  postHostMessage({ type: 'init', protocolVersion: 2 });
  postInitialContext();
  if (latestAudioFrame) postAudioFrame(latestAudioFrame);
}

onMounted(() => {
  audioFrameDisposed = false;
  window.addEventListener('message', handleMessage);
});
onBeforeUnmount(() => {
  loadGeneration += 1;
  audioFrameDisposed = true;
  window.removeEventListener('message', handleMessage);
  unlistenAudioFrame?.();
  unlistenAudioFrame = null;
});
watch(
  () => props.playerDockController?.playbackMetaControlProps.value.queueTracks,
  () => postQueueContext(),
  { deep: true },
);
watch(
  () => props.context.lines,
  () => postLyricsContext(),
  { deep: true },
);
watch(
  () => props.context.background,
  () => postBackgroundContext(),
  { deep: true },
);
watch(
  () => props.context.config,
  () => postConfigContext(),
  { deep: true },
);
watch(
  () => [
    props.context.currentTime,
    props.context.isPlaying,
    props.context.isFavorite,
    props.context.volume,
    props.playerDockController?.playbackMetaControlProps.value.volume,
    props.playerDockController?.playbackMetaControlProps.value.isMuted,
    props.playerDockController?.playbackMetaControlProps.value.playbackRate,
    props.playerDockController?.transportControlProps.value.playbackMode,
    props.playerDockController?.transportControlProps.value.playbackModeLabel,
  ],
  () => postPlaybackContext(),
);
watch(
  () => [
    props.context.activeLyricIndex,
    props.context.lyricTimeOffset,
    props.context.fontSize,
    props.context.lyricColor,
    lyricColors.base.value,
    lyricColors.highlight.value,
    lyricColors.glow.value,
    props.context.useThemeLyricColor,
    props.context.isLoading,
    props.context.loadingText,
    props.context.emptyMessage,
    props.playerDockController?.playbackMetaControlProps.value.locale,
  ],
  () => postLyricsUiContext(),
);
watch(
  () => JSON.stringify({
    activeTrack: serializableTrack(
      props.playerDockController?.playbackMetaControlProps.value.activeTrack,
    ),
    coverUrl: props.context.coverUrl,
  }),
  () => void refreshActiveArtworkDataUrl(),
  { immediate: true },
);
watch(() => [props.entry, props.manifestPath], () => void loadSandboxEntry(), { immediate: true });
</script>

<template>
  <div class="external-lyrics-renderer">
    <div
      class="external-lyrics-window-drag-region"
      aria-hidden="true"
      @pointerdown="startWindowDrag"
    ></div>
    <iframe
      v-if="sandboxEntry"
      ref="frame"
      allowtransparency="true"
      sandbox="allow-scripts"
      :srcdoc="createSandboxDocument(sandboxEntry)"
      @load="handleLoad"
    />
    <p v-if="loadError" class="external-lyrics-renderer-error">{{ loadError }}</p>
    <p v-else-if="!sandboxEntry" class="external-lyrics-renderer-error">正在加载歌词插件...</p>
    <LyricsRendererSearchOverlay :context="props.context.searchDialog" />
  </div>
</template>

<style scoped>
.external-lyrics-renderer {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  background: transparent;
  pointer-events: auto;
  z-index: 1;
}

.external-lyrics-renderer iframe {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
  color-scheme: normal;
  pointer-events: auto;
}

.external-lyrics-window-drag-region {
  position: absolute;
  z-index: 2;
  top: 0;
  right: 112px;
  left: 80px;
  height: 64px;
}

.external-lyrics-renderer-error {
  position: absolute;
  inset: 50% 20px auto;
  transform: translateY(-50%);
  margin: 0;
  text-align: center;
  align-self: center;
  justify-self: center;
  color: var(--smw-text-secondary);
}
</style>
