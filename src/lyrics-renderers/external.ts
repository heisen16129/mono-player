import { defineComponent, h, type PropType } from 'vue';
import { listPluginPackages } from '../services/pluginPackages';
import type { InstalledPluginPackage } from '../types/pluginPackage';
import type { LyricsRendererContext } from '../types/lyricsRenderer';
import type { PlayerDockController } from '../types/playerDockController';
import ExternalLyricsRenderer from '../components/lyrics/renderers/ExternalLyricsRenderer.vue';
import { getLyricsRenderer, registerLyricsRenderer, unregisterLyricsRenderer } from './registry';

const loadedRendererIds = new Map<string, string>();
let externalRendererLoadRequest: Promise<void> | null = null;
let reloadRequested = false;

function registerExternalRenderer(manifest: InstalledPluginPackage) {
  const signature = JSON.stringify(manifest);
  if (loadedRendererIds.get(manifest.id) === signature) return;
  // External packages cannot replace a built-in renderer with the same id.
  if (getLyricsRenderer(manifest.id) && !loadedRendererIds.has(manifest.id)) return;
  const component = defineComponent({
    name: `ExternalLyricsRenderer_${manifest.id.replace(/[^a-zA-Z0-9_$]/g, '_')}`,
    props: {
      context: { type: Object as PropType<LyricsRendererContext>, required: true },
      playerDockController: { type: Object as PropType<PlayerDockController | null>, required: false },
    },
    setup(props) {
      return () => h(ExternalLyricsRenderer, {
        plugin: manifest,
        context: props.context,
        playerDockController: props.playerDockController,
      });
    },
  });
  registerLyricsRenderer({
    id: manifest.id,
    name: manifest.name,
    nameEn: manifest.name,
    description: manifest.description,
    component,
    ownsSurface: true,
    configSchema: manifest.configSchema,
  }, loadedRendererIds.has(manifest.id));
  loadedRendererIds.set(manifest.id, signature);
}

export async function loadExternalLyricsRenderers(refresh = false) {
  if (externalRendererLoadRequest) {
    if (refresh) reloadRequested = true;
    return externalRendererLoadRequest;
  }
  externalRendererLoadRequest = (async () => {
    do {
      reloadRequested = false;
      try {
        const manifests = await listPluginPackages();
        const enabled = manifests
          .filter((manifest) => manifest.enabled && Boolean(manifest.entry.renderer) && manifest.kind === 'lyrics-renderer')
          .filter((manifest) => manifest.capabilities.includes('lyrics-renderer'));
        const enabledIds = new Set(enabled.map(manifest => manifest.id));
        for (const id of loadedRendererIds.keys()) {
          if (!enabledIds.has(id)) {
            loadedRendererIds.delete(id);
            unregisterLyricsRenderer(id);
          }
        }
        enabled.forEach(registerExternalRenderer);
      } catch (error) {
        console.warn('[LyricsRenderer] external renderer discovery failed', error);
      }
    } while (reloadRequested);
  })().finally(() => {
    externalRendererLoadRequest = null;
  });
  return externalRendererLoadRequest;
}
