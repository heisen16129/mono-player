export const API_VERSION = 1 as const;

export type ErrorCode = 'INVALID_ARGUMENT' | 'PERMISSION_DENIED' | 'NOT_FOUND' | 'CONFLICT'
  | 'UNAVAILABLE' | 'UNSUPPORTED' | 'PLUGIN_DISABLED' | 'TIMEOUT' | 'CANCELLED' | 'INTERNAL';

export interface ApiRequest {
  apiVersion: 1;
  requestId: string;
  method: string;
  params: unknown;
}

export type ApiResponse =
  | { requestId: string; ok: true; data: unknown }
  | { requestId: string; ok: false; error: { code: ErrorCode; message: string } };

export interface Track {
  id: string;
  title: string;
  artists: string[];
  album: string | null;
  duration: number | null;
  artworkRef: string | null;
  source: { kind: 'local' | 'remote'; providerId?: string; sourceId?: string };
}

export interface TrackQuery {
  query?: string;
  limit?: number;
  cursor?: string | null;
  sort?: 'title' | 'id';
}

export interface Page<T> { items: T[]; nextCursor: string | null; revision: string; total?: number }
export interface PlayerState {
  mode: 'order' | 'loop' | 'single' | 'shuffle' | 'once';
  position: number;
  duration: number | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  rate: number;
  isBuffering: boolean;
}
export interface HostInfo {
  apiVersion: 1;
  hostVersion: string;
  platform: string;
  surface: string;
  methods: string[];
  grantedPermissions: string[];
  environment: {theme:string; locale:string; windowControlsInset:number; hasPlayerBar:boolean; windowSize:{width:number;height:number}|null};
}

export type LyricsFormat = 'lrc' | 'yrc' | 'qrc' | 'krc' | 'a2' | 'txt' | 'trans';
/** Times and durations are seconds; untimed lines have time: null. */
export interface LyricWord { time: number; duration?: number; text: string }
export interface LyricLine { time: number | null; text: string; words?: LyricWord[] }
