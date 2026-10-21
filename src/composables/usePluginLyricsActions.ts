import { onMounted, onBeforeUnmount, watch, type Ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../services/music';
import type { Track, LyricLine } from '../types/music';

export function usePluginLyricsActions(track: Readonly<Ref<Track | null>>, lines: Ref<LyricLine[]>, offset: Ref<number>, openSearch: () => void) {
  let disposed = false, generation = 0;
  let stop: UnlistenFn | undefined;
  watch([track, lines], async () => {
    if (!track.value || !isTauriRuntime()) return;
    const current = ++generation;
    try {
      const value = await invoke<number>('plugin_lyrics_offset', { track: JSON.parse(JSON.stringify(track.value)) });
      if (!disposed && current === generation) offset.value = value;
    } catch (error) { console.warn('[Plugin lyrics]', error); }
  }, { immediate: true, flush: 'post' });
  onMounted(() => {
    if (!isTauriRuntime()) return;
    void listen<any>('plugins://ui', event => {
      const { method, params } = event.payload;
      if (params.path !== track.value?.path) return;
      if (method === 'lyrics.openSearch') openSearch();
      if (method === 'lyrics.setOffset') offset.value = params.offset;
    }).then(unlisten => { if (disposed) unlisten(); else stop = unlisten; });
  });
  onBeforeUnmount(() => { disposed = true; generation++; stop?.(); });
}
