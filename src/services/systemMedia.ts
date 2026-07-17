import { listen } from '@tauri-apps/api/event';
import { invokeApi } from './api';
import { isTauriRuntime } from './music';

export interface SystemMediaUpdateRequest {
  title: string;
  artist: string | null;
  album: string | null;
  artwork: string | null;
  trackPath: string | null;
  duration: number | null;
  position: number;
  isPlaying: boolean;
}

export interface SystemMediaAction {
  action: 'play' | 'pause' | 'toggle' | 'stop' | 'next' | 'previous' | 'seek' | 'seek-forward' | 'seek-backward' | 'raise' | 'quit';
  position?: number | null;
  offset?: number | null;
}

export function updateSystemMedia(request: SystemMediaUpdateRequest): Promise<void> {
  if (!isTauriRuntime()) return Promise.resolve();
  return invokeApi<void>('system_media_update', { request });
}

export function clearSystemMedia(): Promise<void> {
  if (!isTauriRuntime()) return Promise.resolve();
  return invokeApi<void>('system_media_clear');
}

export function listenSystemMediaAction(callback: (action: SystemMediaAction) => void): Promise<() => void> {
  if (!isTauriRuntime()) return Promise.resolve(() => {});
  return listen<SystemMediaAction>('system-media://action', (event) => callback(event.payload));
}
