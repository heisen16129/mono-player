import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import type { Track } from '../types/music';
import type { PluginSearchTrack } from '../types/plugin';
import { pluginSearchTrackId, pluginSearchTrackKey } from '../utils/trackKey';

interface UsePluginSearchTableTracksOptions {
  activePlaybackTrack: MaybeRefOrGetter<Track | null>;
  activeTrackKey: MaybeRefOrGetter<string | null>;
  resolvingTrackKey: MaybeRefOrGetter<string | null>;
  results: MaybeRefOrGetter<PluginSearchTrack[]>;
}

export function usePluginSearchTableTracks(options: UsePluginSearchTableTracksOptions) {
  const pluginTracks = computed<Track[]>((() => (
    toValue(options.results).map((track) => ({
      id: pluginSearchTrackId(track),
      path: `plugin://${track.providerId}/${encodeURIComponent(track.id)}`,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      artwork: track.artwork ?? null,
      sourceId: track.id,
      sourceName: track.providerName,
      sourceProviderId: track.providerId,
      sourceRaw: track.sourceRaw ?? track,
    }))
  )));

  const pluginTrackByTrackId = computed(() => {
    const results = toValue(options.results);
    return new Map(pluginTracks.value.map((track, index) => [track.id, results[index]]));
  });

  const activeTrack = computed(() => {
    return pluginTracks.value.find((track) => {
      const pluginTrack = pluginTrackByTrackId.value.get(track.id);
      return pluginTrack ? isActivePluginTrack(pluginTrack) : false;
    }) ?? null;
  });

  const preparingTrackId = computed(() => {
    const resolvingTrackKey = toValue(options.resolvingTrackKey);
    if (!resolvingTrackKey) return null;
    return pluginTracks.value.find((track) => {
      const pluginTrack = pluginTrackByTrackId.value.get(track.id);
      return pluginTrack ? pluginSearchTrackKey(pluginTrack) === resolvingTrackKey : false;
    })?.id ?? null;
  });

  function getPluginTrackForTableTrack(track: Track) {
    return pluginTrackByTrackId.value.get(track.id) ?? null;
  }

  function getTrackIdentityKey(track: Track) {
    if (track.sourceProviderId && track.sourceId) return `${track.sourceProviderId}:${track.sourceId}`;
    return track.id;
  }

  function isActivePluginTrack(track: PluginSearchTrack) {
    const activeTrackKey = toValue(options.activeTrackKey);
    if (activeTrackKey && pluginSearchTrackKey(track) === activeTrackKey) return true;

    const active = toValue(options.activePlaybackTrack);
    if (!active) return false;

    if (active.sourceId && active.sourceId === track.id) {
      if (active.sourceProviderId && active.sourceProviderId === track.providerId) return true;
      if (active.sourceName && active.sourceName === track.providerName) return true;
    }

    return false;
  }

  return {
    activeTrack,
    getPluginTrackForTableTrack,
    getTrackIdentityKey,
    pluginTracks,
    preparingTrackId,
  };
}
