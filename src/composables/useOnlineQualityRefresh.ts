import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { resolvePluginPlaybackQualitiesWithRust } from '../services/pluginSearch';
import type { PluginPlaybackQualities, PluginPlaybackQuality, PluginPlaybackQualityOption, PluginSearchTrack } from '../types/plugin';

const qualityRequestsByProvider = new Map<string, Promise<PluginPlaybackQualities>>();

interface OnlineQualityRefreshOptions {
  activePluginTrack: Ref<PluginSearchTrack | null>;
}

export function useOnlineQualityRefresh({ activePluginTrack }: OnlineQualityRefreshOptions) {
  const onlinePlaybackQuality = ref<PluginPlaybackQuality>('');
  const onlinePlaybackQualityOptions = ref<PluginPlaybackQualityOption[]>([]);
  let onlineQualityRefreshTimer: number | null = null;
  let onlineQualityRefreshRequestId = 0;
  let onlinePlaybackQualityTrackKey = '';

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
      onlinePlaybackQualityTrackKey = '';
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

  function applyOnlinePlaybackQualities(result: PluginPlaybackQualities, qualityKey: string) {
    onlinePlaybackQualityOptions.value = result.qualities;
    const availableIds = result.qualities
      .filter((quality) => quality.available)
      .map((quality) => quality.id);
    const currentQuality = onlinePlaybackQualityTrackKey === qualityKey ? onlinePlaybackQuality.value : '';
    const nextQuality = currentQuality && availableIds.includes(currentQuality)
      ? currentQuality
      : result.defaultQuality && availableIds.includes(result.defaultQuality)
        ? result.defaultQuality
        : availableIds[0];
    onlinePlaybackQualityTrackKey = qualityKey;
    onlinePlaybackQuality.value = nextQuality ? nextQuality as PluginPlaybackQuality : '';
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
      applyOnlinePlaybackQualities(result, pluginQualityCacheKey(track));
    } catch {
      if (requestId !== onlineQualityRefreshRequestId) return;
      onlinePlaybackQualityTrackKey = '';
      onlinePlaybackQualityOptions.value = [];
    }
  }

  watch(
    () => activePluginTrack.value ? pluginQualityCacheKey(activePluginTrack.value) : '',
    scheduleOnlinePlaybackQualitiesRefresh,
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
