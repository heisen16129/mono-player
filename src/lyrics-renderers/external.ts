import { defineComponent, h, type PropType } from 'vue';
import { listInstalledPlugins } from '../services/plugins';
import type { PluginManifest } from '../types/plugin';
import type { LyricsRendererContext } from '../types/lyricsRenderer';
import type { PlayerDockController } from '../types/playerDockController';
import ExternalLyricsRenderer from '../components/lyrics/renderers/ExternalLyricsRenderer.vue';
import { registerLyricsRenderer } from './registry';

const loadedRendererIds = new Set<string>();
let externalRendererLoadRequest: Promise<void> | null = null;

function registerExternalRenderer(manifest: PluginManifest) {
  if (loadedRendererIds.has(manifest.id)) return;
  const component = defineComponent({
    name: `ExternalLyricsRenderer_${manifest.id.replace(/[^a-zA-Z0-9_$]/g, '_')}`,
    props: {
      context: { type: Object as PropType<LyricsRendererContext>, required: true },
      playerDockController: { type: Object as PropType<PlayerDockController | null>, required: false },
    },
    setup(props) {
      return () => h(ExternalLyricsRenderer, {
        entry: manifest.entry,
        manifestPath: manifest.sourceKind === 'local' ? manifest.sourceUrl : undefined,
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
  });
  loadedRendererIds.add(manifest.id);
}

export async function loadExternalLyricsRenderers() {
  if (externalRendererLoadRequest) return externalRendererLoadRequest;
  externalRendererLoadRequest = (async () => {
    try {
      const manifests = await listInstalledPlugins();
      manifests
        .filter((manifest) => manifest.enabled && manifest.runtime === 'module' && manifest.kind === 'lyrics-renderer')
        .filter((manifest) => manifest.capabilities.includes('lyrics-renderer'))
        .forEach(registerExternalRenderer);
    } catch (error) {
      console.warn('[LyricsRenderer] external renderer discovery failed', error);
    }
  })().finally(() => {
    externalRendererLoadRequest = null;
  });
  return externalRendererLoadRequest;
}
