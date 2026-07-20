import type { Track } from '../types/music';
import type { PluginSearchTrack } from '../types/plugin';

export function stableStringHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  return hash || 1;
}

export function positiveStableStringHash(value: string) {
  return Math.abs(stableStringHash(value)) || 1;
}

export function pluginSearchTrackKey(track: PluginSearchTrack) {
  return `${track.providerId}:${track.id}`;
}

export function pluginSearchTrackId(track: PluginSearchTrack) {
  return -Math.abs(stableStringHash(pluginSearchTrackKey(track)));
}

export function downloadItemTrackId(id: string) {
  return positiveStableStringHash(id);
}

export function downloadTrackKey(track: Track) {
  const sourceName = track.sourceName ?? '本地';
  const sourceId = track.sourceId ?? String(track.id);
  return `${sourceName}:${sourceId}`;
}

export function trackIdentityKey(track?: Track | null) {
  const providerId = track?.sourceProviderId?.trim();
  const sourceId = track?.sourceId?.trim();
  if (providerId && sourceId) return `plugin:${providerId}:${sourceId}`;
  if (!track) return '';
  return `${track.id}:${track.path}`;
}
