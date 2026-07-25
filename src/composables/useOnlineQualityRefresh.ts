import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { resolvePluginPlaybackQualitiesWithRust } from '../services/pluginSearch';
import type { PluginPlaybackQualities, PluginPlaybackQuality, PluginPlaybackQualityOption, PluginSearchTrack } from '../types/plugin';

const qualitiesByProvider = new Map<string, PluginPlaybackQualities>();
const qualityRequestsByProvider = new Map<string, Promise<PluginPlaybackQualities>>();

interface OnlineQualityRefreshOptions {
  activePluginTrack: Ref<PluginSearchTrack | null>;
}

export function useOnlineQualityRefresh({ activePluginTrack }: OnlineQualityRefreshOptions) {
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

    const cached = qualitiesByProvider.get(track.providerId);
    if (cached) {
      applyOnlinePlaybackQualities(cached);
      return;
    }

    onlinePlaybackQualityOptions.value = [];

    onlineQualityRefreshTimer = window.setTimeout(() => {
      onlineQualityRefreshTimer = null;
      void refreshOnlinePlaybackQualities(onlineQualityRefreshRequestId);
    }, 120);
  }

  function applyOnlinePlaybackQualities(result: PluginPlaybackQualities) {
    onlinePlaybackQualityOptions.value = result.qualities;
    const availableIds = result.qualities
      .filter((quality) => quality.available)
      .map((quality) => quality.id);
    const currentQuality = onlinePlaybackQuality.value;
    const nextQuality = currentQuality && availableIds.includes(currentQuality)
      ? currentQuality
      : result.defaultQuality && availableIds.includes(result.defaultQuality)
        ? result.defaultQuality
        : availableIds[0];
    onlinePlaybackQuality.value = nextQuality ? nextQuality as PluginPlaybackQuality : '';
  }

  function requestOnlinePlaybackQualities(track: PluginSearchTrack) {
    const existing = qualityRequestsByProvider.get(track.providerId);
    if (existing) return existing;

    const request = resolvePluginPlaybackQualitiesWithRust(track)
      .then((result) => {
        qualitiesByProvider.set(track.providerId, result);
        return result;
      })
      .finally(() => {
        qualityRequestsByProvider.delete(track.providerId);
      });
    qualityRequestsByProvider.set(track.providerId, request);
    return request;
  }

  async function refreshOnlinePlaybackQualities(requestId: number) {
    const track = activePluginTrack.value;
    if (!track) return;

    try {
      const result = await requestOnlinePlaybackQualities(track);
      if (requestId !== onlineQualityRefreshRequestId) return;
      applyOnlinePlaybackQualities(result);
    } catch {
      if (requestId !== onlineQualityRefreshRequestId) return;
      onlinePlaybackQualityOptions.value = [];
    }
  }

  watch(
    () => activePluginTrack.value ? activePluginTrack.value.providerId : '',
    scheduleOnlinePlaybackQualitiesRefresh,
  );

  onBeforeUnmount(clearOnlinePlaybackQualitiesRefreshTimer);

  return {
    onlinePlaybackQuality,
    onlinePlaybackQualityOptions,
  };
}
