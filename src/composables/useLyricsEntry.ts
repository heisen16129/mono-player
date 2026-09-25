import type { Ref } from 'vue';
import type { LyricsRendererPlugin } from '../types/lyricsRenderer';
import type { PluginConfig } from '../types/plugin';
import { listInstalledPluginManifests } from '../services/plugins';
import { openDesktopPlaybackCard } from '../services/desktopPlaybackCard';

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
      const manifests = await listInstalledPluginManifests();
      const card = manifests.find(manifest => manifest.id === 'playback-card'
        && manifest.enabled && manifest.kind === 'lyrics-renderer' && manifest.runtime === 'module');
      if (!card) throw new Error('播放卡片插件不可用，请在插件设置中检查。');
      const manifestPath = card.sourceKind === 'local' ? card.sourceUrl
        : !/^https?:/i.test(card.entry) ? card.entry.replace(/[^/\\]+$/, 'manifest.json') : undefined;
      await openDesktopPlaybackCard(card.entry, manifestPath, { ...options.config.value });
    } catch (error) {
      options.notify(`无法打开播放卡片：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      opening = false;
    }
  }
  return { openSelectedLyrics };
}
