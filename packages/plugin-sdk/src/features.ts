import type { Page, Track, TrackQuery, LyricLine, LyricsFormat } from './protocol';

export type Call = <T>(method: string, params?: unknown) => Promise<T>;
export interface Playlist { id: string; name: string; trackIds: string[]; revision?: string }
export interface QueueEntry { entryId: string; track: Track }
export interface Queue { items: QueueEntry[]; revision: string; currentEntryId: string | null }
export interface Source { id: string; name: string }
export interface Resource { url: string; expiresAt?: string }

// These are the v1 contracts used by bundled plugins. host.getInfo reports which
// contracts a surface actually implements; an unavailable method never falls back.
export function createFeatures(call: Call) {
  return {
    service: { getConnection: () => call<{ url: string; token: string }>('service.getConnection') },
    files: {
      choose: (kind: 'file' | 'directory') => call<{reference:string;name:string;kind:'file'|'directory'} | null>('files.choose', { kind }),
      reveal: (path: string) => call<void>('files.reveal', { path }),
    },
    speaker: {
      getConnection: () => call<{ url: string; token: string }>('speaker.getConnection'),
    },
    playlists: {
      create: (name: string, trackIds: string[] = []) => call<{id:string}>('playlists.create', {name,trackIds}),
      update: (playlistId: string, name: string) => call<void>('playlists.update', {playlistId,name}),
      delete: (playlistId: string) => call<void>('playlists.delete', {playlistId}),
      reorderTracks: (playlistId: string, trackIds: string[], expectedRevision: string) => call<void>('playlists.reorderTracks', {playlistId,trackIds,expectedRevision}),
      list: (params: TrackQuery = {}) => call<Page<Playlist>>('playlists.list', params),
      get: (playlistId: string) => call<Playlist>('playlists.get', { playlistId }),
      listTracks: (playlistId: string, params: TrackQuery = {}) => call<Page<Track>>('playlists.listTracks', { playlistId, ...params }),
      addTracks: (playlistId: string, trackIds: string[]) => call<void>('playlists.addTracks', { playlistId, trackIds }),
      removeTracks: (playlistId: string, trackIds: string[]) => call<void>('playlists.removeTracks', { playlistId, trackIds }),
    },
    queue: {
      replace: (trackIds: string[], expectedRevision: string) => call<Queue>('queue.replace', {trackIds,expectedRevision}),
      append: (trackIds: string[], expectedRevision: string) => call<Queue>('queue.append', {trackIds,expectedRevision}),
      insert: (trackIds: string[], beforeEntryId: string | null, expectedRevision: string) => call<Queue>('queue.insert', {trackIds,beforeEntryId,expectedRevision}),
      remove: (entryIds: string[], expectedRevision: string) => call<Queue>('queue.remove', {entryIds,expectedRevision}),
      reorder: (entryIds: string[], expectedRevision: string) => call<Queue>('queue.reorder', {entryIds,expectedRevision}),
      clear: (expectedRevision: string) => call<Queue>('queue.clear', {expectedRevision}),
      get: () => call<Queue>('queue.get'),
      play: (entryId: string) => call<void>('queue.play', { entryId }),
    },
    favorites: {
      list: (params: TrackQuery = {}) => call<Page<Track>>('favorites.list', params),
      contains: (trackId: string) => call<boolean>('favorites.contains', { trackId }),
      set: (trackId: string, favorite: boolean) => call<void>('favorites.set', { trackId, favorite }),
    },
    lyrics: {
      parse: (params: { content: string; format?: LyricsFormat }) => call<LyricLine[]>('lyrics.parse', params),
      get: (trackId: string) => call<{ lyrics: { format: string; content: string }[] }>('lyrics.get', { trackId }),
      setOffset: (trackId: string, offset: number) => call<void>('lyrics.setOffset', { trackId, offset }),
      openSearch: (trackId: string) => call<void>('lyrics.openSearch', { trackId }),
    },
    artwork: {
      get: (artworkRef: string) => call<Resource>('artwork.get', { artworkRef }),
      refresh: (artworkRef: string) => call<void>('artwork.refresh', { artworkRef }),
    },
    sources: {
      list: () => call<Source[]>('sources.list'),
      search: (params: { query: string; providerId: string; limit?: number; cursor?: string }) => call<Page<Track>>('sources.search', params),
      importTracks: (tracks: { providerId: string; sourceId: string }[]) => call<Track[]>('sources.importTracks', { tracks }),
    },
    media: { prepare: (trackId: string) => call<Resource>('media.prepare', { trackId }) },
    history: { recordPlayed: (trackId: string) => call<void>('history.recordPlayed', { trackId }) },
    storage: {
      get: <T = unknown>(key: string) => call<T | null>('storage.get', { key }),
      set: (key: string, value: unknown) => call<void>('storage.set', { key, value }),
      delete: (key: string) => call<void>('storage.delete', { key }),
      keys: () => call<string[]>('storage.keys'),
    },
    ui: {
      close: () => call<void>('ui.close'),
      openSettings: () => call<void>('ui.openSettings'),
      openPage: (pageId: string, options: { surface?: 'page' | 'desktop' } = {}) => call<void>('ui.openPage', { pageId, ...options }),
      notify: (message: string) => call<void>('ui.notify', { message }),
    },
    window: { startDragging: () => call<void>('window.startDragging') },
  };
}
