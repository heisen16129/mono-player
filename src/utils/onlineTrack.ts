import type { Track, TrackLyrics } from '../types/music';
import type { PluginSearchTrack } from '../types/plugin';
import { pluginSearchTrackId, pluginSearchTrackKey } from './trackKey';

interface OnlinePlaybackSource {
  url?: string;
  path?: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number | null;
  artwork?: string | null;
  year?: number | null;
  genre?: string | null;
  trackNumber?: number | null;
  lyrics?: TrackLyrics | null;
  sourceId?: string;
  sourceName?: string;
  sourceProviderId?: string;
  sourceRaw?: unknown;
}

interface OnlineTrackCandidates {
  searchResults: PluginSearchTrack[];
  activePluginTrack?: PluginSearchTrack | null;
}

interface BuildOnlinePlaybackQueueOptions {
  queueTracks?: Track[];
  searchResults: PluginSearchTrack[];
  findPluginTrack: (track: Track) => PluginSearchTrack | null;
  mapPlaybackTrack: (track: Track) => Track;
  dedupeTracks: (tracks: Track[]) => Track[];
}

export function createOnlineQueueTrack(track: PluginSearchTrack, source?: OnlinePlaybackSource): Track {
  const lyrics = source?.lyrics?.lyrics.length ? {
    providerId: track.providerId,
    providerName: track.providerName,
    trackId: track.id,
    defaultFormat: source.lyrics.defaultFormat ?? source.lyrics.lyrics[0]?.format ?? null,
    lyrics: source.lyrics.lyrics,
    trackRaw: track.raw ?? track,
  } : null;

  return {
    id: pluginSearchTrackId(track),
    path: source?.path ?? source?.url ?? `plugin://${track.providerId}/${encodeURIComponent(track.id)}`,
    title: source?.title ?? track.title,
    artist: source?.artist ?? track.artist,
    album: source?.album ?? track.album,
    duration: source?.duration ?? track.duration,
    artwork: source?.artwork ?? track.artwork ?? null,
    year: source?.year ?? track.year ?? null,
    genre: source?.genre ?? track.genre ?? null,
    trackNumber: source?.trackNumber ?? track.trackNumber ?? null,
    lyrics,
    sourceId: source?.sourceId ?? track.id,
    sourceName: source?.sourceName ?? track.providerName,
    sourceProviderId: source?.sourceProviderId ?? track.providerId,
    sourceRaw: source?.sourceRaw ?? track.raw ?? track,
  };
}

export function findPluginTrackForQueueTrack(track: Track, candidates: OnlineTrackCandidates) {
  const cachedTrack = candidates.searchResults.find((item) => {
    if (pluginSearchTrackId(item) === track.id) return true;
    return Boolean(track.sourceProviderId && track.sourceId)
      && item.providerId === track.sourceProviderId
      && item.id === track.sourceId;
  })
    ?? (candidates.activePluginTrack && (
      pluginSearchTrackId(candidates.activePluginTrack) === track.id
      || (
        Boolean(track.sourceProviderId && track.sourceId)
        && candidates.activePluginTrack.providerId === track.sourceProviderId
        && candidates.activePluginTrack.id === track.sourceId
      )
    )
      ? candidates.activePluginTrack
      : null);
  if (cachedTrack) return cachedTrack;

  if (!track.sourceProviderId || !track.sourceId) return null;
  return {
    id: track.sourceId,
    providerId: track.sourceProviderId,
    providerName: track.sourceName ?? track.sourceProviderId,
    title: track.title,
    artist: track.artist ?? '',
    album: track.album ?? '',
    duration: track.duration,
    artwork: track.artwork ?? null,
    raw: track.sourceRaw ?? track,
  };
}

export function buildOnlinePlaybackQueue(
  sourceTrack: PluginSearchTrack,
  playbackTrack: Track,
  options: BuildOnlinePlaybackQueueOptions,
) {
  const sourceKey = pluginSearchTrackKey(sourceTrack);
  const contextQueue = options.queueTracks
    ?.filter((track) => track.path)
    .map((track) => {
      const pluginTrack = options.findPluginTrack(track);
      return pluginTrack && pluginSearchTrackKey(pluginTrack) === sourceKey ? playbackTrack : track;
    })
    .map(options.mapPlaybackTrack) ?? [];
  if (contextQueue.length > 0) {
    return options.dedupeTracks(contextQueue);
  }

  const searchQueue = options.searchResults.map((item) => (
    pluginSearchTrackKey(item) === sourceKey ? playbackTrack : options.mapPlaybackTrack(createOnlineQueueTrack(item))
  ));

  return options.dedupeTracks(searchQueue.length > 0 ? searchQueue : [playbackTrack]);
}

export function isSameOnlineTrackIdentity(left: Track, right: Track) {
  return Boolean(left.sourceProviderId && left.sourceId)
    && left.sourceProviderId === right.sourceProviderId
    && left.sourceId === right.sourceId;
}
