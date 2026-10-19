import type { Track } from '../types/music';
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { resolvePluginPlaybackQualitiesWithRust } from '../services/pluginSearch';
import type { PluginPlaybackQualities, PluginPlaybackQuality, PluginPlaybackQualityOption, PluginSearchTrack } from '../types/plugin';

const qualityRequestsByProvider = new Map<string, Promise<PluginPlaybackQualities>>();

interface OnlineQualityRefreshOptions {
  activePluginTrack: Ref<PluginSearchTrack | null>;
  activePlaybackTrack: { readonly value: Track | null };
}

export function useOnlineQualityRefresh({ activePluginTrack, activePlaybackTrack }: OnlineQualityRefreshOptions) {
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
    const track = activePluginTrack.value;
    if (!track) {
      onlinePlaybackQuality.value = '';
      onlinePlaybackQualityOptions.value = [];
      return;
    }

    onlinePlaybackQualityOptions.value = [];

    onlineQualityRefreshTimer = window.setTimeout(() => {
      onlineQualityRefreshTimer = null;
      void refreshOnlinePlaybackQualities(onlineQualityRefreshRequestId);
    }, 120);
  }

  function requestOnlinePlaybackQualities(track: PluginSearchTrack) {
    const qualityKey = pluginQualityCacheKey(track);
    const existing = qualityRequestsByProvider.get(qualityKey);
    if (existing) return existing;

    const request = resolvePluginPlaybackQualitiesWithRust(track)
      .finally(() => {
        qualityRequestsByProvider.delete(qualityKey);
      });
    qualityRequestsByProvider.set(qualityKey, request);
    return request;
  }

  async function refreshOnlinePlaybackQualities(requestId: number) {
    const track = activePluginTrack.value;
    if (!track) return;

    try {
      const result = await requestOnlinePlaybackQualities(track);
      if (requestId !== onlineQualityRefreshRequestId) return;
      onlinePlaybackQualityOptions.value = result.qualities;
    } catch {
      if (requestId !== onlineQualityRefreshRequestId) return;
      onlinePlaybackQualityOptions.value = [];
    }
  }

  watch(
    () => activePluginTrack.value ? pluginQualityCacheKey(activePluginTrack.value) : '',
    scheduleOnlinePlaybackQualitiesRefresh,
  );

  watch(
    () => [activePluginTrack.value?.providerId, activePluginTrack.value?.id, activePlaybackTrack.value?.sourceProviderId, activePlaybackTrack.value?.sourceId, activePlaybackTrack.value?.actualQuality],
    () => {
      const source = activePluginTrack.value;
      const playing = activePlaybackTrack.value;
      onlinePlaybackQuality.value = source && playing?.sourceProviderId === source.providerId && playing.sourceId === source.id
        ? playing.actualQuality ?? '' : '';
    },
    { immediate: true },
  );

  onBeforeUnmount(clearOnlinePlaybackQualitiesRefreshTimer);

  return {
    onlinePlaybackQuality,
    onlinePlaybackQualityOptions,
  };
}

function pluginQualityCacheKey(track: PluginSearchTrack) {
  return `${track.providerId}:${track.id}`;
}
