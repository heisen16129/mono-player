import type { Track } from '../types/music';
import { filePathToArtworkUrl } from '../utils/artwork';
import { readTrackCoverOriginal } from './music';

const pending = new Map<string, Promise<string | null>>();

export async function recoverTrackCover(track: Track) {
  const artwork = track.artwork;
  if (!artwork || !/^(?:file:|https?:\/\/asset\.localhost\/|asset:\/\/localhost\/)/i.test(artwork)) return;
  if (!/[\\/]cover-thumbnails[\\/]|%2fcover-thumbnails%2f/i.test(artwork)) return;
  let request = pending.get(track.path);
  if (!request) {
    request = readTrackCoverOriginal(track.path).catch(() => null);
    pending.set(track.path, request);
  }
  try {
    const original = await request;
    if (original && track.artwork === artwork) {
      track.artwork = filePathToArtworkUrl(original);
      track.coverVersion = Date.now();
    }
  } finally {
    if (pending.get(track.path) === request) pending.delete(track.path);
  }
}
