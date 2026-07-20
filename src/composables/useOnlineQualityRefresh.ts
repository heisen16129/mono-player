import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { resolvePluginPlaybackQualitiesWithRust } from '../services/pluginSearch';
import type { PluginPlaybackQuality, PluginPlaybackQualityOption, PluginSearchTrack } from '../types/plugin';

interface OnlineQualityRefreshOptions {
  activePluginTrack: Ref<PluginSearchTrack | null>;
  trackKey: (track: PluginSearchTrack) => string;
}

export function useOnlineQualityRefresh({ activePluginTrack, trackKey }: OnlineQualityRefreshOptions) {
  const onlinePlaybackQuality = ref<PluginPlaybackQuality>('');
  const onlinePlaybackQualityOptions = ref<PluginPlaybackQualityOption[]>([]);
  let onlineQualityRefreshTimer: number | null = null;
  let onlineQualityRefreshRequestId = 0;

  function clearOnlinePlaybackQualitiesRefreshTimer() {
    if (onlineQualityRefreshTimer === null) return;
    window.clearTimeout(onlineQualityRefreshTimer);
    onlineQualityRefreshTimer = null;
  }

  function scheduleOnlinePlaybackQualitiesRefresh() {
    onlineQualityRefreshRequestId += 1;
    clearOnlinePlaybackQualitiesRefreshTimer();
    onlinePlaybackQualityOptions.value = [];
    if (!activePluginTrack.value) return;

    onlineQualityRefreshTimer = window.setTimeout(() => {
      onlineQualityRefreshTimer = null;
      void refreshOnlinePlaybackQualities(onlineQualityRefreshRequestId);
    }, 120);
  }

  async function refreshOnlinePlaybackQualities(requestId: number) {
    const track = activePluginTrack.value;
    if (!track) return;

    try {
      const result = await resolvePluginPlaybackQualitiesWithRust(track);
      if (requestId !== onlineQualityRefreshRequestId) return;
      onlinePlaybackQualityOptions.value = result.qualities;
      const availableIds = result.qualities
        .filter((quality) => quality.available)
        .map((quality) => quality.id);
      const nextQuality = result.defaultQuality && availableIds.includes(result.defaultQuality)
        ? result.defaultQuality
        : availableIds[0];
      if (nextQuality) {
        onlinePlaybackQuality.value = nextQuality as PluginPlaybackQuality;
      }
    } catch {
      if (requestId !== onlineQualityRefreshRequestId) return;
      onlinePlaybackQualityOptions.value = [];
    }
  }

  watch(
    () => activePluginTrack.value ? trackKey(activePluginTrack.value) : '',
    scheduleOnlinePlaybackQualitiesRefresh,
  );

  onBeforeUnmount(clearOnlinePlaybackQualitiesRefreshTimer);

  return {
    onlinePlaybackQuality,
    onlinePlaybackQualityOptions,
  };
}
