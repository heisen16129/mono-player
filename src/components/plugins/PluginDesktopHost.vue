<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { listPluginPackages } from '../../services/pluginPackages';
import { connectPluginPage } from '../../services/pluginApiTransport';
import type { InstalledPluginPackage } from '../../types/pluginPackage';
import type { DesktopLyricsState } from '../../services/desktopLyrics';
import { resolveLyricsSource } from '../../services/music';
import { useDesktopLyricsAppearance } from '../../composables/useDesktopLyricsAppearance';
import { listenRustBackendAudioFrame } from '../../services/playerBackend';
const frame = ref<HTMLIFrameElement | null>(null);
const url = ref('');
const error = ref('');
const query = new URLSearchParams(location.search);
const id = query.get('pluginDesktop') || query.get('rendererId') || '';
const pageId = query.get('pageId') || '__renderer';
const { appearanceStyle } = pageId === '__renderer' ? useDesktopLyricsAppearance(340,500) : { appearanceStyle:computed(()=>({})) };
let plugin: InstalledPluginPackage | undefined;
let close: (() => void) | undefined;
let present: ((track: unknown) => Promise<any>) | undefined;
let state: DesktopLyricsState | undefined;
let identity = '', trackKey = '', generation = 0, disposed = false;
let permissions: string[] = [];
let refreshing = false, refreshedAt = 0;
let playback: Record<string, unknown> = {};
const stops: UnlistenFn[] = [];
function post(message: unknown) { frame.value?.contentWindow?.postMessage({type:'mono:renderer-update',apiVersion:1,message}, '*'); }
async function update(next: DesktopLyricsState, force = false) {
  state = next;
  if (!present || !plugin?.entry.renderer) return;
  const key = JSON.stringify([next.track,next.lyricContent,next.lyricFormat]);
  if (!refreshing && (force || key !== identity || Date.now()-refreshedAt >= 500)) {
    refreshing = true;
    const changed = force || key !== identity;
    const current = ++generation;
    try {
      const data = await present(next.track);
      if (disposed || current !== generation) return;
      permissions = data.permissions;
      trackKey = data.track?.id ?? '';
      post({type:'track',trackKey,activeTrack:data.track});
      post({type:'queue',queueTracks:(data.queue?.items ?? []).map((item:any)=>({...item.track,artist:item.track.artists,entryId:item.entryId}))});
      post({type:'config',config:{...data.config,desktop:true}});
      const mode = data.playback?.mode;
      playback = {volume:data.playback?.volume,isMuted:data.playback?.isMuted,playbackRate:data.playback?.rate,
        playbackMode:mode === 'loop' ? 'repeat' : mode === 'single' ? 'fixed' : mode,
        isFavorite:permissions.includes('favorites.read') && data.favorite === true};
      if (changed && permissions.includes('lyrics.read')) {
        const lines = await resolveLyricsSource({content:next.lyricContent,format:next.lyricFormat});
        if (disposed || current !== generation) return;
        post({type:'lyrics',trackKey,lines});
      }
      if (permissions.includes('lyrics.read')) post({type:'lyrics-ui',lyricsUi:{lyricColor:next.lyricColor,lyricTimeOffset:data.offset,fontSize:24,locale:'zh-CN',isLoading:false}});
      identity = key;
      refreshedAt = Date.now();
    } finally { refreshing = false; }
  }
  if (permissions.includes('player.read')) post({type:'playback',playback:{...playback,currentTime:next.currentTime,isPlaying:next.isPlaying}});
}
async function connect() {
  if (!frame.value || !plugin) return;
  try {
    close?.();
    const connected = await connectPluginPage(frame.value, plugin.id, pageId, plugin.packageRevision, value => { present = value; });
    if (disposed) { connected(); return; }
    close = connected;
    if (state) await update(state,true);
    await emit('desktop-lyrics://ready');
  } catch (reason) { error.value = String(reason); }
}
function ready(event:MessageEvent) {
  if (event.source === frame.value?.contentWindow && event.data?.type === 'mono:renderer-ready' && state) void update(state,true);
}
onMounted(async () => {
  try {
    window.addEventListener('message',ready);
    plugin = (await listPluginPackages()).find(p => p.id === id && p.enabled);
    if (!plugin) throw new Error('插件未安装或已停用');
    const entry = pageId === '__renderer' && plugin.entry.renderer ? 'ui/index.html' : plugin.contributions.pages.find(p => p.id === pageId)?.entry;
    if (!entry) throw new Error('插件未声明此页面');
    const add = (stop:UnlistenFn) => { if (disposed) stop(); else stops.push(stop); };
    add(await listen<DesktopLyricsState>('plugins://presentation', e => { void update(e.payload).catch(reason => error.value = String(reason)); }));
    add(await listen<any>('plugins://ui', e => { if (e.payload.method === 'lyrics.setOffset' && state && e.payload.params.path === state.track?.path) void update(state,true);  if (e.payload.pluginId === id && e.payload.method === 'ui.close' && e.payload.surface === `desktop:${getCurrentWindow().label}`) void getCurrentWindow().close(); }));
    add(await listen<boolean>('plugins://availability', e => { if (!e.payload) { permissions=[]; close?.(); void getCurrentWindow().close(); } }));
    add(await listen<any>('plugins://config', e => { if (e.payload.pluginId === id && state) void update(state,true); }));
    add(await listen('plugins://changed', async () => {
      const current = (await listPluginPackages()).find(p => p.id === id && p.enabled);
      if (!current || current.packageRevision !== plugin?.packageRevision) await getCurrentWindow().close();
    }));
    add(await listenRustBackendAudioFrame(audio => { if (permissions.includes('audio.read')) post({type:'audio-frame',frame:{...audio,samples:Array.from(audio.samples)}}); }));
    if (disposed) return;
    url.value = convertFileSrc('', 'plugin-page').replace(/\/?$/, '/') + [id, plugin.packageRevision,...entry.split('/')].map(encodeURIComponent).join('/');
  } catch (reason) { error.value = String(reason); }
});
onBeforeUnmount(() => { disposed = true; generation++; close?.(); stops.forEach(stop=>stop()); window.removeEventListener('message',ready); });
</script>
<template>
  <iframe v-if="url" ref="frame" :style="appearanceStyle" :src="url" sandbox="allow-scripts" referrerpolicy="no-referrer" @load="connect" />
  <p v-if="error" role="alert">{{ error }} <button @click="getCurrentWindow().close()">关闭</button></p>
</template>
<style scoped>
iframe { display:block; width:100vw; height:100vh; border:0; background:transparent; }
p { padding:20px; background:var(--smw-bg); color:var(--smw-text-primary); }
</style>
