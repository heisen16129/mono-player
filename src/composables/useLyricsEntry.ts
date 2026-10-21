import type { Ref } from 'vue';
import type { LyricsRendererPlugin } from '../types/lyricsRenderer';
import type { PluginConfig } from '../types/plugin';
import { listPluginPackages } from '../services/pluginPackages';
import { openPluginDesktop } from '../services/pluginDesktop';

interface LyricsEntryOptions {
  renderer: Readonly<Ref<LyricsRendererPlugin | null>>;
  config: Readonly<Ref<PluginConfig>>;
  toggleLyricsView: () => void;
  notify: (message: string) => void;
}

export function useLyricsEntry(options: LyricsEntryOptions) {
  let opening = false;
  async function openSelectedLyrics() {
    if (options.renderer.value?.id !== 'playback-card') {
      options.toggleLyricsView();
      return;
    }
    if (opening) return;
    opening = true;
    try {
      const card = (await listPluginPackages()).find(p => p.id === 'playback-card' && p.enabled);
      if (!card) throw new Error('播放卡片插件不可用，请在插件设置中检查。');
      await openPluginDesktop(card, '__renderer');
    } catch (error) {
      options.notify(`无法打开播放卡片：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      opening = false;
    }
  }
  return { openSelectedLyrics };
}
