import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invokeApi } from '../services/api';
import { readArtworkFile } from '../services/music';
import { DESKTOP_CARD_UPDATE, DESKTOP_CARD_CONFIG, saveDesktopCardStyle } from '../services/desktopPlaybackCard';
import { DESKTOP_LYRICS_ACTION_EVENT, DESKTOP_LYRICS_READY_EVENT, type DesktopLyricsState } from '../services/desktopLyrics';
import { useDesktopLyricsLoader } from './useDesktopLyricsLoader';
import { createLyricsSandboxDocument } from '../utils/lyricsSandbox';
import { artworkBlobDataUrl, artworkDisplaySrc, artworkUrlDataUrl } from '../utils/artwork';
import { getPluginConfig, savePluginConfig } from '../services/plugins';
import type { PluginConfig } from '../types/plugin';
import type { Track } from '../types/music';

export function useDesktopPlaybackCardBridge(frame: Ref<HTMLIFrameElement | null>) {
  const documentSource = ref('');
  const error = ref('');
  const activeTrack = ref<Track | null>(null);
  const lyricContent = ref<string | null>(null), lyricFormat = ref<string | null>(null);
  const { lyricLines, stopLyricsLoading } = useDesktopLyricsLoader({ activeTrack, lyricContent, lyricFormat });
  let unlisten: UnlistenFn | undefined;
  let unlistenConfig: UnlistenFn | undefined;
  const query = new URLSearchParams(location.search);
  const rendererId = query.get('rendererId') || 'playback-card';
  let config: PluginConfig = { desktop: true, cardStyle: query.get('cardStyle') || 'minimal' };
  let disposed = false, ready = false, artworkGeneration = 0, trackIdentity = '';
  let artworkDataUrl = '';
  let playback = { currentTime: 0, isPlaying: false };
  const trackKey = () => `${activeTrack.value?.id ?? ''}:${activeTrack.value?.path ?? ''}`;
  function send(message: unknown) { if (ready) frame.value?.contentWindow?.postMessage(message, '*'); }
  function sendTrack() {
    send({ type: 'track', trackKey: trackKey(), activeTrack: activeTrack.value ? { ...JSON.parse(JSON.stringify(activeTrack.value)), artworkDataUrl } : null });
  }
  function sendLyrics() { send({ type: 'lyrics', trackKey: trackKey(), lines: JSON.parse(JSON.stringify(lyricLines.value)) }); }
  function initialize() {
    ready = true;
    send({ type: 'init', protocolVersion: 2 });
    sendTrack(); sendLyrics();
    send({ type: 'config', config });
    send({ type: 'playback', playback });
  }
  async function updateState(state: DesktopLyricsState) {
    playback = { currentTime: state.currentTime, isPlaying: state.isPlaying };
    lyricContent.value = state.lyricContent; lyricFormat.value = state.lyricFormat;
    const identity = JSON.stringify(state.track);
    if (identity !== trackIdentity) {
      trackIdentity = identity;
      activeTrack.value = state.track;
      artworkDataUrl = '';
      sendTrack();
      const generation = ++artworkGeneration;
      const source = state.track?.associatedArtwork || state.track?.artwork || '';
      try {
        let data = '';
        if (/^file:\/\//i.test(source)) {
          const file = await readArtworkFile(source);
          if (file) data = await artworkBlobDataUrl(new Blob([new Uint8Array(file.data)], { type: file.mime_type }));
        } else if (source) data = await artworkUrlDataUrl(artworkDisplaySrc(source));
        if (!disposed && generation === artworkGeneration) { artworkDataUrl = data; sendTrack(); }
      } catch { /* The card keeps its artwork placeholder when a cover is unavailable. */ }
    }
    send({ type: 'playback', playback });
  }
  watch(lyricLines, sendLyrics);
  async function handleMessage(event: MessageEvent) {
    if (event.source !== frame.value?.contentWindow) return;
    if (event.data?.type === 'lyrics-renderer-error') { error.value = String(event.data.message); return; }
    if (event.data?.type !== 'lyrics-renderer-action') return;
    const action = event.data.action;
    try {
      if (action === 'close') await getCurrentWindow().close();
      else if (action === 'seekTime' && Number.isFinite(event.data.payload?.time)) {
        await emit(DESKTOP_LYRICS_ACTION_EVENT, { type: 'seek', time: Math.max(0, Math.min(activeTrack.value?.duration || 0, event.data.payload.time)) });
      }
      else if (action === 'dragWindow') await getCurrentWindow().startDragging();
      else if (action === 'updateConfig' && event.data.payload?.config && typeof event.data.payload.config === 'object' && !Array.isArray(event.data.payload.config)) {
        config = { ...event.data.payload.config, desktop: true };
        send({ type: 'config', config });
        if (rendererId === 'playback-card') await saveDesktopCardStyle(String(config.cardStyle || 'minimal'));
        else await savePluginConfig(rendererId, config);
      }
      else {
        const actions: Record<string, string> = { togglePlayback: 'toggle-play', playPrevious: 'previous', playNext: 'next' };
        if (actions[action]) await emit(DESKTOP_LYRICS_ACTION_EVENT, actions[action]);
      }
    } catch (cause) { error.value = String(cause); }
  }
  onMounted(async () => {
    window.addEventListener('message', handleMessage);
    try {
      const listener = await listen<DesktopLyricsState>(DESKTOP_CARD_UPDATE, event => { void updateState(event.payload); });
      if (disposed) { listener(); return; }
      unlisten = listener;
      const configListener = await listen<{ cardStyle: string }>(DESKTOP_CARD_CONFIG, event => {
        config = { desktop: true, cardStyle: event.payload.cardStyle };
        send({ type: 'config', config });
      });
      if (disposed) { configListener(); return; }
      unlistenConfig = configListener;
      config = { ...config, ...await getPluginConfig(rendererId === 'playback-card' ? 'lyrics-renderer.playback-card' : rendererId), desktop: true };
      const source = query.get('entry') === 'builtin:playback-card'
        ? (await import('../../plugins/playback-card/renderer.mjs?raw')).default
        : await invokeApi<string>('read_local_renderer_module', { manifestPath: query.get('manifestPath'), modulePath: query.get('entry') });
      if (disposed) return;
      documentSource.value = createLyricsSandboxDocument('local-module', source);
      await emit(DESKTOP_LYRICS_READY_EVENT);
    } catch (cause) { error.value = String(cause); }
  });
  onBeforeUnmount(() => {
    disposed = true; artworkGeneration++; unlisten?.(); unlistenConfig?.(); stopLyricsLoading();
    window.removeEventListener('message', handleMessage);
  });

  return { documentSource, error, initialize, close: () => getCurrentWindow().close() };
}
