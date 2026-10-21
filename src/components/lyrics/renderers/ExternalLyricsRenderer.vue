<script setup lang="ts">
import { usePlayerStore } from '../../../stores/player';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { connectPluginPage } from '../../../services/pluginApiTransport';
import { useWindowDrag } from '../../../composables/useWindowDrag';
import { listenRustBackendAudioFrame } from '../../../services/playerBackend';
import type { InstalledPluginPackage } from '../../../types/pluginPackage';
import type { LyricsRendererContext } from '../../../types/lyricsRenderer';
import type { PlayerDockController } from '../../../types/playerDockController';
import LyricsRendererSearchOverlay from '../LyricsRendererSearchOverlay.vue';
const props = defineProps<{ plugin: InstalledPluginPackage; context: LyricsRendererContext; playerDockController?: PlayerDockController | null }>();
const player = usePlayerStore();
const frame = ref<HTMLIFrameElement | null>(null);
const loadError = ref('');
const { startWindowDrag } = useWindowDrag();
const url = computed(() => convertFileSrc('', 'plugin-page').replace(/\/?$/, '/') + [props.plugin.id, props.plugin.packageRevision, 'ui', 'index.html'].map(encodeURIComponent).join('/'));
let disconnect: (() => void) | undefined;
let present: ((track: unknown) => Promise<any>) | undefined;
let generation = 0;
let disposed = false;
const addStop = (stop: UnlistenFn) => { if (disposed) stop(); else stops.push(stop); };
let permissions: string[] = [];
let trackKey = '';
const stops: UnlistenFn[] = [];
const activeTrack = () => props.playerDockController?.playbackMetaControlProps.value.activeTrack ?? null;
function post(message: Record<string, unknown>) {
  if (!player.settings.enablePlugins) return;
  frame.value?.contentWindow?.postMessage({ type: 'mono:renderer-update', apiVersion: 1, message: JSON.parse(JSON.stringify(message)) }, '*');
}
function postContext() {
  const c = props.context;
  if (permissions.includes('lyrics.read')) {
    post({type:'lyrics', trackKey, lines:c.lines});
    post({type:'lyrics-ui', lyricsUi:{activeLyricIndex:c.activeLyricIndex,lyricTimeOffset:c.lyricTimeOffset,fontSize:c.fontSize,lyricColor:c.lyricColor,lyricHighlightColor:c.lyricHighlightColor,lyricGlowColor:c.lyricGlowColor,isLoading:c.isLoading,loadingText:c.loadingText,emptyMessage:c.emptyMessage,locale:'zh-CN'}});
  }
  if (permissions.includes('player.read')) {
    const meta = props.playerDockController?.playbackMetaControlProps.value;
    post({type:'playback',playback:{currentTime:c.currentTime,isPlaying:c.isPlaying,isFavorite:permissions.includes('favorites.read') && c.isFavorite,volume:c.volume,isMuted:meta?.isMuted ?? false,playbackRate:meta?.playbackRate ?? 1,playbackMode:props.playerDockController?.transportControlProps.value.playbackMode ?? 'fixed'}});
  }
  // Only presentation colors are shared; custom background file paths stay in the host.
  post({type:'background',background:{color:(c.background as any).color}});
}
async function refresh() {
  if (!present) return;
  const current = ++generation;
  try {
    const data = await present(JSON.parse(JSON.stringify(activeTrack())));
    if (current !== generation) return;
    permissions = data.permissions;
    trackKey = data.track?.id ?? '';
    post({type:'track',trackKey,activeTrack:data.track});
    post({type:'queue',queueTracks:(data.queue?.items ?? []).map((item:any) => ({...item.track,artist:item.track.artists,entryId:item.entryId}))});
    post({type:'config',config:data.config ?? {}});
    postContext();
  } catch (error) { if (current === generation) loadError.value = String(error); }
}
async function connect() {
  disconnect?.(); present = undefined; permissions = []; generation++;
  if (!frame.value) return;
  const current = generation;
  try {
    const close = await connectPluginPage(frame.value, props.plugin.id, '__renderer', props.plugin.packageRevision, value => { present = value; });
    if (current !== generation) { close(); return; }
    disconnect = close; await refresh();
  } catch (error) { loadError.value = String(error); }
}
function ready(event: MessageEvent) { if (event.source === frame.value?.contentWindow && event.data?.type === 'mono:renderer-ready') void refresh(); }
onMounted(() => {
  window.addEventListener('message', ready);
  void listen<any>('plugins://ui', event => {
    const e = event.payload;
    if (e.pluginId !== props.plugin.id || e.revision !== props.plugin.packageRevision) return;
    if (e.method === 'ui.close' && e.surface === 'renderer') props.context.close();

  }).then(addStop).catch(error => { if (!disposed) loadError.value = String(error); });
  void listen<any>('plugins://config', e => { if (e.payload.pluginId === props.plugin.id) void refresh(); }).then(addStop);
  void listenRustBackendAudioFrame(audio => { if (permissions.includes('audio.read')) post({type:'audio-frame',frame:{...audio,samples:Array.from(audio.samples)}}); }).then(addStop).catch(error => { if (!disposed) loadError.value = String(error); });
});
watch(() => player.settings.enablePlugins, enabled => { if (!enabled) { generation++; disconnect?.(); present=undefined; permissions=[]; } });
watch(() => [activeTrack(), props.playerDockController?.playbackMetaControlProps.value.queueTracks], refresh, {deep:true});
watch(() => [props.context.currentTime,props.context.isPlaying,props.context.isFavorite,props.context.volume,props.context.lines,props.context.activeLyricIndex,props.context.lyricTimeOffset,props.context.fontSize,props.context.isLoading], postContext, {deep:true});
onBeforeUnmount(() => { disposed = true; generation++; disconnect?.(); stops.forEach(stop => stop()); window.removeEventListener('message',ready); });
</script>
<template>
  <div class="external-lyrics-renderer">
    <div class="external-lyrics-window-drag-region" aria-hidden="true" @mousedown="startWindowDrag"></div>
    <iframe v-if="player.settings.enablePlugins" ref="frame" :key="url" :src="url" sandbox="allow-scripts" referrerpolicy="no-referrer" @load="connect" />
    <p v-if="loadError" class="external-lyrics-renderer-error">{{ loadError }}</p>
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
