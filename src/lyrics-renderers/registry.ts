import { ref } from 'vue';
import type { LyricsRendererPlugin } from '../types/lyricsRenderer';

const rendererPlugins = new Map<string, LyricsRendererPlugin>();
export const lyricsRendererRegistryVersion = ref(0);

export const DEFAULT_LYRICS_RENDERER_ID = 'classic';

export function registerLyricsRenderer(plugin: LyricsRendererPlugin) {
  const id = plugin.id.trim();
  if (!id) throw new Error('歌词渲染插件必须提供 id。');
  if (rendererPlugins.has(id)) throw new Error(`歌词渲染插件已注册：${id}`);

  rendererPlugins.set(id, { ...plugin, id });
  lyricsRendererRegistryVersion.value += 1;
}

export function listLyricsRenderers() {
  return [...rendererPlugins.values()];
}

export function getLyricsRenderer(id: string | null | undefined) {
  return id ? rendererPlugins.get(id) ?? null : null;
}
