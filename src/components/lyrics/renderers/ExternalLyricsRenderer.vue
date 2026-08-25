<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue';
import { useWindowDrag } from '../../../composables/useWindowDrag';
import { invokeApi } from '../../../services/api';
import { readArtworkFile } from '../../../services/music';
import { listenRustBackendState } from '../../../services/playerBackend';
import type { LyricsRendererContext } from '../../../types/lyricsRenderer';
import type { Track } from '../../../types/music';
import type { PlayerDockController } from '../../../types/playerDockController';
import { artworkBlobDataUrl, artworkDisplaySrc, artworkUrlDataUrl, trackArtworkSource } from '../../../utils/artwork';
import LyricsRendererSearchOverlay from '../LyricsRendererSearchOverlay.vue';

const props = defineProps<{
  entry: string;
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
let unlistenSpectrum: (() => void) | null = null;
let latestSpectrum: number[] = [];
let spectrumDisposed = false;
const serializableTrackCache = new WeakMap<object, Track>();
const artworkDataUrlCache = new Map<string, Promise<string>>();
const activeArtworkDataUrl = ref('');
let artworkLoadGeneration = 0;

function serializableTrack(track: Track | null | undefined) {
  if (!track) return null;
  const rawTrack = toRaw(track);
  const cached = serializableTrackCache.get(rawTrack);
  if (cached) return cached;
  const serialized = JSON.parse(JSON.stringify(rawTrack)) as Track;
  serializableTrackCache.set(rawTrack, serialized);
  return serialized;
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
  const activeTrack = props.playerDockController?.playbackMetaControlProps.value.activeTrack;
  if (!activeTrack) return;
  const reference = activeArtworkReference(activeTrack, String(props.context.coverUrl || '').trim());
  if (!reference) return;
  try {
    const dataUrl = await cachedArtworkDataUrl(reference);
    if (generation !== artworkLoadGeneration) return;
    activeArtworkDataUrl.value = dataUrl;
    postContext(true);
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
  if (/^(https?:|data:|blob:)/i.test(props.entry)) {
    sandboxEntry.value = props.entry;
    return;
  }
  if (!props.manifestPath) {
    loadError.value = '插件缺少本地 manifest 路径。';
    return;
  }
  try {
    const source = await invokeApi<string>('read_local_renderer_module', {
      manifestPath: props.manifestPath,
      modulePath: props.entry,
    });
    if (generation !== loadGeneration) return;
    sandboxModuleSource.value = source;
    sandboxEntry.value = 'local-module';
  } catch (error) {
    if (generation !== loadGeneration) return;
    loadError.value = error instanceof Error ? error.message : String(error);
  }
}

function createSandboxDocument(entry: string) {
  const serializedEntry = JSON.stringify(entry).replace(/</g, '\\u003c');
  const serializedSource = JSON.stringify(sandboxModuleSource.value).replace(/</g, '\\u003c');
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}</style><script>
const entry=${serializedEntry};const source=${serializedSource};let renderer=null;let rendererReady=false;let moduleUrl=entry;let latestSpectrum=[];let pendingContext=null;let api={post:(action,payload,requestId)=>parent.postMessage({type:'lyrics-renderer-action',action,payload,requestId},'*')};
function mergePendingContext(current,next){if(!current)return next||{};if(!next)return current;const previousTrack=current.activeTrack;const nextTrack=next.activeTrack;const hasNextTrack=Object.prototype.hasOwnProperty.call(next,'activeTrack');const sameTrack=previousTrack&&nextTrack&&String(previousTrack.id??previousTrack.path??'')===String(nextTrack.id??nextTrack.path??'');return {...current,...next,activeTrack:hasNextTrack?(nextTrack?{...(sameTrack?previousTrack:{}),...nextTrack}:null):previousTrack}}
async function applyPendingContext(){if(!rendererReady||!pendingContext||!renderer?.update)return;const next=pendingContext;pendingContext=null;await renderer.update(next)}
window.addEventListener('message',async(event)=>{if(event.source!==parent)return;const message=event.data||{};try{if(message.type==='init'){rendererReady=false;const initialContext=mergePendingContext(message.context,pendingContext);pendingContext=null;if(source!==null)moduleUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));const loaded=await import(moduleUrl);renderer=loaded.default||loaded;if(typeof renderer.mount!=='function')throw new Error('Renderer must export mount(root, context, api)');await renderer.mount(document.body,initialContext,api);rendererReady=true;await applyPendingContext();if(renderer.updateAudioSpectrum)renderer.updateAudioSpectrum(latestSpectrum)}else if(message.type==='update'){if(rendererReady&&renderer?.update)await renderer.update(message.context);else pendingContext=mergePendingContext(pendingContext,message.context)}else if(message.type==='audio-spectrum'){latestSpectrum=Array.isArray(message.levels)?message.levels:[];if(rendererReady&&renderer?.updateAudioSpectrum)renderer.updateAudioSpectrum(latestSpectrum)}else if(message.type==='lyrics-renderer-action-result'&&String(message.requestId||'').includes('playback-')){console.log('[歌词插件通信桥][播放控制] 执行结果',{请求编号:message.requestId,是否成功:message.ok,错误信息:message.message||''})}}catch(error){parent.postMessage({type:'lyrics-renderer-error',message:String(error)},'*') }});
<\/script>`;
}

function contextPayload(context: LyricsRendererContext, includeArtworkData = false) {
  const lines = context.lines.map((line) => ({
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
  const config = Object.fromEntries(
    Object.entries(context.config).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.map((item) => String(item)) : value,
    ]),
  );
  const meta = props.playerDockController?.playbackMetaControlProps.value;
  const transport = props.playerDockController?.transportControlProps.value;
  const queueTracks = meta?.queueTracks ?? [];
  const activeTrack = serializableTrack(meta?.activeTrack);
  const activeTrackPayload = activeTrack && includeArtworkData && activeArtworkDataUrl.value
    ? { ...activeTrack, artworkDataUrl: activeArtworkDataUrl.value }
    : activeTrack;
  return {
    lines,
    currentTime: context.currentTime,
    isPlaying: context.isPlaying,
    isFavorite: context.isFavorite,
    activeLyricIndex: context.activeLyricIndex,
    lyricTimeOffset: context.lyricTimeOffset,
    fontSize: context.fontSize,
    lyricColor: context.lyricColor,
    useThemeLyricColor: context.useThemeLyricColor,
    coverUrl: context.coverUrl,
    isLoading: context.isLoading,
    emptyMessage: context.emptyMessage,
    loadingText: context.loadingText,
    label: context.label,
    title: context.title,
    artist: context.artist,
    album: context.album,
    duration: context.duration,
    volume: meta?.volume ?? context.volume,
    isMuted: meta?.isMuted ?? false,
    locale: meta?.locale ?? 'zh-CN',
    playbackRate: meta?.playbackRate ?? 1,
    playbackMode: transport?.playbackMode ?? 'fixed',
    playbackModeLabel: transport?.playbackModeLabel ?? '',
    activeTrack: activeTrackPayload,
    queueTracks: queueTracks.map((track) => serializableTrack(track)),
    config,
  };
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

function postContext(includeArtworkData = false) {
  try {
    frame.value?.contentWindow?.postMessage({
      type: 'update',
      context: contextPayload(props.context, includeArtworkData),
    }, '*');
  } catch (error) {
    loadError.value = `歌词插件通信失败：${error instanceof Error ? error.message : String(error)}`;
  }
}

function postSpectrum(levels: number[]) {
  latestSpectrum = levels.slice(0, 5).map((level) => Math.max(0, Math.min(1, Number(level) || 0)));
  frame.value?.contentWindow?.postMessage({ type: 'audio-spectrum', levels: latestSpectrum }, '*');
}

async function startSpectrumBridge() {
  const unlisten = await listenRustBackendState((state) => {
    postSpectrum(state.isPlaying ? (state.spectrumLevels ?? []) : []);
  });
  if (spectrumDisposed) {
    unlisten();
    return;
  }
  unlistenSpectrum = unlisten;
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
  try {
    frame.value?.contentWindow?.postMessage({
      type: 'init',
      context: contextPayload(props.context, Boolean(activeArtworkDataUrl.value)),
    }, '*');
    postSpectrum(latestSpectrum);
  } catch (error) {
    loadError.value = `歌词插件通信失败：${error instanceof Error ? error.message : String(error)}`;
  }
}

onMounted(() => {
  spectrumDisposed = false;
  window.addEventListener('message', handleMessage);
  void startSpectrumBridge();
});
onBeforeUnmount(() => {
  spectrumDisposed = true;
  window.removeEventListener('message', handleMessage);
  unlistenSpectrum?.();
  unlistenSpectrum = null;
});
watch(
  () => [
    props.context,
    props.playerDockController?.playbackMetaControlProps.value,
    props.playerDockController?.transportControlProps.value,
  ],
  () => postContext(),
  { deep: true },
);
watch(
  () => [
    props.playerDockController?.playbackMetaControlProps.value.activeTrack?.id,
    props.playerDockController?.playbackMetaControlProps.value.activeTrack?.path,
    props.playerDockController?.playbackMetaControlProps.value.activeTrack?.associatedArtwork,
    props.playerDockController?.playbackMetaControlProps.value.activeTrack?.artwork,
    props.playerDockController?.playbackMetaControlProps.value.activeTrack?.coverVersion,
    props.context.coverUrl,
  ],
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
