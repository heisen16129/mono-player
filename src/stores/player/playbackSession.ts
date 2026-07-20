import type { PlaybackMode, PlaybackSession, Track } from '../../types/music';
import { dedupeTracksByPath } from './normalizers';

export function createPlaybackSessionSnapshot(currentTime: number, playbackMode: PlaybackMode, currentTrack: Track | null, queueTracks: Track[]) {
  const nextQueue = queueTracks.filter((item) => item.path);
  if (currentTrack?.path && !nextQueue.some((item) => item.path === currentTrack.path)) {
    nextQueue.unshift(currentTrack);
  }

  if (!currentTrack && nextQueue.length === 0) return null;

  return {
    currentTrack: currentTrack ?? null,
    queueTracks: nextQueue,
    currentTime: Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0,
    playbackMode,
    savedAt: Date.now(),
  } satisfies PlaybackSession;
}

export function resolvePlaybackSessionRestore(session: PlaybackSession) {
  const nextQueue = dedupeTracksByPath(session.queueTracks.filter((track) => track.path));
  const current = session.currentTrack?.path ? session.currentTrack : nextQueue[0] ?? null;
  if (current?.path && !nextQueue.some((track) => track.path === current.path)) {
    nextQueue.unshift(current);
  }

  if (!current && nextQueue.length === 0) return null;

  return {
    current,
    currentTime: session.currentTime,
    playbackMode: session.playbackMode,
    queue: nextQueue,
  };
}
