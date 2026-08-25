import { computed, ref, type Ref } from 'vue';
import {
  DEFAULT_LYRICS_RENDERER_ID,
  getLyricsRenderer,
  listLyricsRenderers,
  lyricsRendererRegistryVersion,
} from '../lyrics-renderers/registry';
import { ensureBuiltinLyricsRenderers } from '../lyrics-renderers/builtins';
import { loadExternalLyricsRenderers } from '../lyrics-renderers/external';

export function useLyricsRendererRuntime(selectedPluginId?: Ref<string>) {
  ensureBuiltinLyricsRenderers();
  void loadExternalLyricsRenderers();
  const activePluginId = selectedPluginId ?? ref(DEFAULT_LYRICS_RENDERER_ID);
  const rendererPlugins = computed(() => {
    lyricsRendererRegistryVersion.value;
    return listLyricsRenderers();
  });
  const activePlugin = computed(() => {
    return getLyricsRenderer(activePluginId.value)
      ?? getLyricsRenderer(DEFAULT_LYRICS_RENDERER_ID)
      ?? rendererPlugins.value[0]
      ?? null;
  });
  const rendererError = ref<unknown | null>(null);

  function selectRenderer(pluginId: string) {
    if (!getLyricsRenderer(pluginId)) return false;
    rendererError.value = null;
    activePluginId.value = pluginId;
    return true;
  }

  function handleRendererError(error: unknown, pluginId: string) {
    rendererError.value = error;
    console.error(`[LyricsRenderer:${pluginId}] render failed`, error);
  }

  return {
    activePlugin,
    activePluginId,
    handleRendererError,
    rendererError,
    rendererPlugins,
    selectRenderer,
  };
}
