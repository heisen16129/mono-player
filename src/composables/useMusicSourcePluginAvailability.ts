import { computed, onMounted, ref, watch, type ComputedRef } from 'vue';
import { listInstalledPlugins } from '../services/plugins';

export function useMusicSourcePluginAvailability(pluginsEnabled: ComputedRef<boolean>) {
  const hasInstalledMusicSourcePlugin = ref(false);

  async function refreshMusicSourcePluginAvailability() {
    if (!pluginsEnabled.value) {
      hasInstalledMusicSourcePlugin.value = false;
      return;
    }

    const plugins = await listInstalledPlugins().catch(() => []);
    hasInstalledMusicSourcePlugin.value = plugins.some((plugin) => (
      plugin.enabled && plugin.kind === 'music' && plugin.capabilities.includes('search')
    ));
  }

  onMounted(() => {
    void refreshMusicSourcePluginAvailability();
  });

  watch(pluginsEnabled, () => {
    void refreshMusicSourcePluginAvailability();
  });

  const hasMusicSourcePlugin = computed(() => pluginsEnabled.value && hasInstalledMusicSourcePlugin.value);

  return {
    hasMusicSourcePlugin,
    refreshMusicSourcePluginAvailability,
  };
}
