// Translate Mono tracks and string playlist IDs into the upstream MIoT model.
export class Library {
  constructor(mono, storage, snapshotTtl = 0) { this.mono = mono; this.storage = storage; this.songIds = []; this.mapping = Promise.resolve(); this.snapshotTtl = snapshotTtl; this.snapshotPending = null; this.snapshotCache = null; this.snapshotExpires = 0; }
  async registerSongs(tracks) {
    this.mapping = this.mapping.then(async () => {
      const ids = JSON.parse(await this.storage.get('mono_song_ids') || '[]');
      let changed = false;
      for (const track of tracks) if (!ids.includes(track.id)) { ids.push(track.id); changed = true; }
      this.songIds = ids;
      if (changed) await this.storage.set('mono_song_ids', JSON.stringify(ids));
    });
    await this.mapping;
  }
  async snapshot() {
    if (this.snapshotCache && Date.now() < this.snapshotExpires) return this.snapshotCache;
    if (this.snapshotPending) return this.snapshotPending;
    this.snapshotPending = (async () => {
      const all = async read => {
        const items = []; let cursor;
        do { const page = await read({ limit: 200, cursor }); items.push(...page.items); cursor = page.nextCursor; } while (cursor);
        return items;
      };
      const [tracks, favorites, playlists] = await Promise.all([
        all(params => this.mono.library.listTracks(params)), all(params => this.mono.favorites.list(params)),
        all(params => this.mono.playlists.list(params)),
      ]);
      const byId = new Map(tracks.map(track => [track.id, track]));
      for (const track of favorites) if (!byId.has(track.id)) byId.set(track.id, track);
      for (const playlist of playlists) {
        const entries = await all(params => this.mono.playlists.listTracks(playlist.id, params));
        playlist.trackIds = entries.map(track => track.id);
        for (const track of entries) if (!byId.has(track.id)) byId.set(track.id, track);
      }
      const data = { tracks: [...byId.values()], favorites: { ids: favorites.map(track => track.id) }, playlists };
      await this.registerSongs(data.tracks);
      this.snapshotCache = data; this.snapshotExpires = Date.now() + this.snapshotTtl;
      return data;
    })();
    try { return await this.snapshotPending; } finally { this.snapshotPending = null; }
  }
  async monoId(id) {
    if (this.songIds[Number(id) - 1] === undefined) await this.snapshot();
    const value = this.songIds[Number(id) - 1];
    if (value === undefined) throw new Error('歌曲不存在');
    return value;
  }
  song(track) {
    const id = this.songIds.indexOf(track.id) + 1;
    return { id, title: track.title, artist: (track.artists || []).join(' / '),
      album: track.album || '', duration: track.duration || 0, type: track.source.kind,
      url: `/api/v1/songs/${id}/play`, cover_url: `/api/v1/songs/${id}/cover`,
      lyric_url: `/api/v1/songs/${id}/lyric`, created_at: track.addedAt || '',
      source_data: JSON.stringify(track), plugin_entry_path: track.source.providerId || '' };
  }
  async songs(options = {}) {
    let songs = (await this.snapshot()).tracks.map(t => this.song(t));
    if (options.keyword) songs = songs.filter(s => `${s.title} ${s.artist}`.toLowerCase().includes(options.keyword.toLowerCase()));
    return songs.slice(options.offset || 0, (options.offset || 0) + (options.limit || 100000));
  }
  async songById(id) {
    const data = await this.snapshot();
    const track = data.tracks.find(t => t.id === this.songIds[Number(id) - 1]);
    if (!track) throw new Error('歌曲已从 Mono 曲库中移除');
    return this.song(track);
  }
  async playlists() {
    const data = await this.snapshot();
    const keys = JSON.parse(await this.storage.get('mono_playlist_ids') || '[]');
    let changed = false;
    const lists = [{ id: '__all', name: '全部歌曲', trackIds: data.tracks.map(t => t.id) },
      { id: '__favorites', name: '收藏', trackIds: data.favorites.ids || [], is_favorite: true }, ...data.playlists];
    const available = new Set(data.tracks.map(t => t.id));
    const result = lists.map(p => {
      if (!keys.includes(p.id)) { keys.push(p.id); changed = true; }
      return { id: keys.indexOf(p.id) + 1, name: p.name, song_count: [...new Set(p.trackIds || [])].filter(id => available.has(id)).length,
        is_favorite: !!p.is_favorite, type: 'normal', labels: p.is_favorite ? ['built_in'] : [], monoId: p.id };
    });
    if (changed) await this.storage.set('mono_playlist_ids', JSON.stringify(keys));
    return result;
  }
  async playlist(id) {
    const playlist = (await this.playlists()).find(p => p.id === Number(id));
    if (!playlist) throw new Error('歌单不存在');
    return playlist;
  }
  async playlistSongs(id, options = {}) {
    const playlist = await this.playlist(id);
    const data = await this.snapshot();
    const ids = playlist.monoId === '__all' ? data.tracks.map(t => t.id)
      : playlist.monoId === '__favorites' ? data.favorites.ids || []
      : data.playlists.find(p => p.id === playlist.monoId)?.trackIds || [];
    const byId = new Map(data.tracks.map(t => [t.id, t]));
    let songs = [...new Set(ids)].map(id => byId.get(id)).filter(Boolean).map(t => this.song(t));
    if (['title', 'artist', 'album', 'created_at'].includes(options.sort)) {
      songs.sort((a, b) => String(a[options.sort]).localeCompare(String(b[options.sort]), 'zh-CN') * (options.order === 'desc' ? -1 : 1));
    }
    return songs.slice(options.offset || 0, (options.offset || 0) + (options.limit || 100000));
  }
  async editPlaylist(id, ids, add) {
    const monoIds = await Promise.all(ids.map(id => this.monoId(id)));
    const playlistId = (await this.playlist(id)).monoId;
    if (playlistId === '__all') throw new Error('全部歌曲不可作为普通歌单修改');
    const result = playlistId === '__favorites'
      ? await Promise.all(monoIds.map(id => this.mono.favorites.set(id, add)))
      : await this.mono.playlists[add ? 'addTracks' : 'removeTracks'](playlistId, monoIds);
    this.snapshotExpires = 0;
    return result;
  }
}
