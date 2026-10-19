import type { PlayerStatus } from '../types';

export interface DeviceMedia {
  title?: string;
  artist?: string;
}

export function deviceMedia(detail: any): DeviceMedia | undefined {
  if (!detail || typeof detail !== 'object') return undefined;
  const title = typeof detail.title === 'string' ? detail.title.trim() : '';
  const artist = typeof detail.artist === 'string' ? detail.artist.trim() : '';
  return title || artist ? { title, artist } : undefined;
}

// Do not attach Mono's old song ID/cover/seek offset to native speaker playback.
export function externalPlaybackStatus(
  local: PlayerStatus, device: { state: string; position: number; duration: number; volume: number; media?: DeviceMedia },
  streamMatch: 'ours' | 'foreign' | 'unknown', voiceSuspended: boolean,
): Record<string, any> | null {
  if (device.state !== 'playing' && device.state !== 'paused') return null;
  const differentTitle = !!device.media?.title && !!local.current_song?.title
    && device.media.title !== local.current_song.title;
  const external = !local.current_song || differentTitle
    || ((local.state === 'idle' || local.state === 'stopped' || voiceSuspended) && streamMatch !== 'ours')
    || (local.state === 'paused' && streamMatch === 'foreign');
  if (!external) return null;
  return {
    ...local, current_song: null, current_index: -1, playlist_id: 0, playlist_name: undefined,
    state: device.state, is_playing: device.state === 'playing', speed: 1,
    position: device.position, duration: device.duration, volume: device.volume,
    external_media: { title: device.media?.title || '音箱正在播放', artist: device.media?.artist || '' },
  };
}
