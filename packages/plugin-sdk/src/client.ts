import { API_VERSION, type ApiRequest, type ApiResponse, type ErrorCode, type HostInfo, type Page, type Track, type TrackQuery, type PlayerState } from './protocol';
export * from './protocol';
import { createFeatures } from './features';
import { createSubscriptions } from './subscriptions';
export type { PluginEvent, AudioFrame, Topic } from './subscriptions';

export interface Transport {
  send(request: ApiRequest): void;
  subscribe(listener: (response: ApiResponse) => void): () => void;
}

export class PluginApiError extends Error {
  constructor(readonly code: ErrorCode, message: string) { super(message); this.name = 'PluginApiError'; }
}

export function createMono(transport: Transport, options: { timeoutMs?: number } = {}) {
  let sequence = 0;
  let disposed = false;
  const pending = new Map<string, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  const stop = transport.subscribe(response => {
    const request = pending.get(response.requestId);
    if (!request) return;
    pending.delete(response.requestId);
    clearTimeout(request.timer);
    if (response.ok) request.resolve(response.data);
    else request.reject(new PluginApiError(response.error.code, response.error.message));
  });

  function call<T>(method: string, params: unknown = {}): Promise<T> {
    const timeout = options.timeoutMs ?? (method === 'files.choose' ? 300_000 : 15_000);
    if (disposed) return Promise.reject(new PluginApiError('CANCELLED', 'Plugin instance has been disposed'));
    const requestId = String(++sequence);
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new PluginApiError('TIMEOUT', `Request timed out: ${method}`));
      }, timeout);
      pending.set(requestId, { resolve: value => resolve(value as T), reject, timer });
      try { transport.send({ apiVersion: API_VERSION, requestId, method, params }); }
      catch (error) {
        clearTimeout(timer);
        pending.delete(requestId);
        reject(error);
      }
    });
  }

  const subscriptions = createSubscriptions(call);
  return {
    events: subscriptions.events,
    audio: subscriptions.audio,
    ...createFeatures(call),
    host: { getInfo: () => call<HostInfo>('host.getInfo') },
    library: {
      listArtists: (params: TrackQuery = {}) => call<Page<{id:string;name:string;trackCount:number}>>('library.listArtists', params),
      listAlbums: (params: TrackQuery = {}) => call<Page<{id:string;name:string;trackCount:number}>>('library.listAlbums', params),
      listTracks: (params: TrackQuery = {}) => call<Page<Track>>('library.listTracks', params),
      getTrack: (trackId: string) => call<Track>('library.getTrack', { trackId }),
      removeTrack: (trackId: string) => call<void>('library.removeTrack', { trackId }),
    },
    config: {
      get: () => call<Record<string, unknown>>('config.get'),
      set: (config: Record<string, unknown>) => call<Record<string, unknown>>('config.set', { config }),
    },
    player: {
      getState: () => call<PlayerState>('player.getState'),
      playTrack: (trackId: string) => call<void>('player.playTrack', { trackId }),
      play: () => call<void>('player.play'),
      pause: () => call<void>('player.pause'),
      stop: () => call<void>('player.stop'),
      next: () => call<void>('player.next'),
      previous: () => call<void>('player.previous'),
      seek: (position: number) => call<void>('player.seek', { position }),
      setVolume: (volume: number) => call<void>('player.setVolume', { volume }),
      setMuted: (muted: boolean) => call<void>('player.setMuted', { muted }),
      setRate: (rate: number) => call<void>('player.setRate', { rate }),
      setMode: (mode: 'order' | 'loop' | 'single' | 'shuffle' | 'once') => call<void>('player.setMode', { mode }),
    },
    dispose() {
      if (disposed) return;
      subscriptions.dispose();
      disposed = true;
      stop();
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(new PluginApiError('CANCELLED', 'Plugin instance has been disposed'));
      }
      pending.clear();
    },
  };
}
