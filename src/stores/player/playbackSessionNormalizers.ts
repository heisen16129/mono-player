import type { PlaybackMode, PlaybackSession, Track } from '../../types/music';
import { normalizeTrackSnapshot } from './favoriteNormalizers';
import { dedupeTracksByPath } from './pathNormalizers';

export function normalizePlaybackSession(value: unknown): PlaybackSession | null {
  try {
    if (!value || typeof value !== 'object') return null;
    const parsed = value as Partial<PlaybackSession>;
    const playbackMode: PlaybackMode =
      parsed.playbackMode === 'repeat' || parsed.playbackMode === 'fixed' ? parsed.playbackMode : 'shuffle';
    const currentTime = Number(parsed.currentTime);
    const currentTrack = normalizeTrackSnapshot(parsed.currentTrack);
    const queueTracks = dedupeTracksByPath(Array.isArray(parsed.queueTracks)
      ? parsed.queueTracks
        .map((track) => normalizeTrackSnapshot(track))
        .filter((track): track is Track => Boolean(track?.path))
      : []);

    if (currentTrack?.path && !queueTracks.some((track) => track.path === currentTrack.path)) {
      queueTracks.unshift(currentTrack);
    }

    if (!currentTrack && queueTracks.length === 0) return null;

    return {
      currentTrack,
      queueTracks,
      currentTime: Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0,
      playbackMode,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}
