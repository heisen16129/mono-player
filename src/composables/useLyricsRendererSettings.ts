import { computed, ref } from 'vue';
import { isTauriRuntime } from '../services/music';
import { listPluginConfigs, savePluginConfig } from '../services/plugins';
import type { PluginConfig } from '../types/plugin';
import { ensureBuiltinLyricsRenderers } from '../lyrics-renderers/builtins';
import { loadExternalLyricsRenderers } from '../lyrics-renderers/external';
import {
  DEFAULT_LYRICS_RENDERER_ID,
  getLyricsRenderer,
  listLyricsRenderers,
  lyricsRendererRegistryVersion,
} from '../lyrics-renderers/registry';

const LYRICS_RENDERER_HOST_CONFIG_ID = 'lyrics-renderer.host';
const activeRendererId = ref(DEFAULT_LYRICS_RENDERER_ID);
const rendererConfigs = ref<Record<string, PluginConfig>>({});
const isHydrated = ref(false);
let hydrateRequest: Promise<void> | null = null;
let rendererSelectionVersion = 0;

function rendererConfigId(pluginId: string) {
  return `lyrics-renderer.${pluginId}`;
}

function normalizeConfig(config: PluginConfig | undefined) {
  return config && typeof config === 'object' ? { ...config } : {};
}

export function useLyricsRendererSettings() {
  ensureBuiltinLyricsRenderers();
  void loadExternalLyricsRenderers();

  const rendererPlugins = computed(() => {
    lyricsRendererRegistryVersion.value;
    return listLyricsRenderers();
  });
  const activeRenderer = computed(() => {
    return getLyricsRenderer(activeRendererId.value)
      ?? getLyricsRenderer(DEFAULT_LYRICS_RENDERER_ID)
      ?? rendererPlugins.value[0]
      ?? null;
  });
  const activeRendererConfig = computed(() => {
    const plugin = activeRenderer.value;
    if (!plugin) return {};
    return {
      ...(plugin.defaultConfig ?? {}),
      ...(rendererConfigs.value[plugin.id] ?? {}),
    };
  });

  function hydrateLyricsRendererSettings() {
    if (isHydrated.value) return Promise.resolve();
    if (hydrateRequest) return hydrateRequest;
    hydrateRequest = (async () => {
      if (!isTauriRuntime()) {
        isHydrated.value = true;
        return;
      }

      const selectionVersionAtStart = rendererSelectionVersion;
      await loadExternalLyricsRenderers();
      const configs = await listPluginConfigs();
      const storedRendererId = configs[LYRICS_RENDERER_HOST_CONFIG_ID]?.rendererId;
      if (
        rendererSelectionVersion === selectionVersionAtStart
        && typeof storedRendererId === 'string'
        && getLyricsRenderer(storedRendererId)
      ) {
        activeRendererId.value = storedRendererId;
      }

      rendererConfigs.value = Object.fromEntries(
        rendererPlugins.value.map((plugin) => [
          plugin.id,
          normalizeConfig(configs[rendererConfigId(plugin.id)]),
        ]),
      );
      isHydrated.value = true;
    })().finally(() => {
      hydrateRequest = null;
    });
    return hydrateRequest;
  }

  function selectLyricsRenderer(pluginId: string) {
    if (!getLyricsRenderer(pluginId)) return false;
    rendererSelectionVersion += 1;
    activeRendererId.value = pluginId;
    if (isTauriRuntime()) {
      void savePluginConfig(LYRICS_RENDERER_HOST_CONFIG_ID, { rendererId: pluginId });
    }
    return true;
  }

  function saveLyricsRendererConfig(pluginId: string, config: PluginConfig) {
    if (!getLyricsRenderer(pluginId)) return false;
    const normalizedConfig = normalizeConfig(config);
    rendererConfigs.value = {
      ...rendererConfigs.value,
      [pluginId]: normalizedConfig,
    };
    if (isTauriRuntime()) {
      void savePluginConfig(rendererConfigId(pluginId), normalizedConfig);
    }
    return true;
  }

  return {
    activeRenderer,
    activeRendererConfig,
    activeRendererId,
    hydrateLyricsRendererSettings,
    isHydrated,
    rendererPlugins,
    saveLyricsRendererConfig,
    selectLyricsRenderer,
  };
}
