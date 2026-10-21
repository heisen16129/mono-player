import { connectHost } from './host.mjs';
import http from 'node:http';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';
import { randomBytes } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { installCompat } from './compat.mjs';
import { Library } from './library.mjs';
import { serveFile, serveMedia, stopMedia } from './media.mjs';
import { normalizeMediaQuery } from './request-url.mjs';
import { mediaAddresses, resolveMediaHost } from './network.mjs';

installCompat();
console.log = console.info = console.warn = console.error = () => {};

const [bridgeFile, dataDir, staticDir, ffmpeg = 'ffmpeg'] = process.argv.slice(2);
if (!bridgeFile || !dataDir || !staticDir) throw new Error('Mono 音箱服务必须由宿主启动');
mkdirSync(dataDir, { recursive: true });
const storageFile = join(dataDir, 'settings.json');
const stored = existsSync(storageFile) ? JSON.parse(readFileSync(storageFile, 'utf8')) : {};
const storage = {
  async get(key) { return stored[key] ?? null; },
  async set(key, value) {
    stored[key] = value;
    writeFileSync(`${storageFile}.tmp`, JSON.stringify(stored), { mode: 0o600 });
    renameSync(`${storageFile}.tmp`, storageFile);
  },
};
const bridge = JSON.parse(readFileSync(bridgeFile, 'utf8'));
const mono = connectHost(bridge);
const library = new Library(mono, storage, 1000);
const token = randomBytes(32).toString('hex');
const mediaToken = randomBytes(32).toString('hex');
const prefix = '/api/v1/jsplugin/miot';
let localBase = '', mediaPort = 0;
const addresses = () => mediaAddresses(networkInterfaces(), mediaPort);
globalThis.monoServerHost = () => resolveMediaHost(JSON.parse(stored.config || '{}'), addresses());
const comm = new Map();
const registeredProviders = new Set();
async function refreshProviders() {
  const plugins = await mono.sources.list();
  const active = new Set(plugins.map(p => p.id));
  for (const id of registeredProviders) if (!active.has(id)) {
    await comm.get('unregister-search-provider')?.({}, id); registeredProviders.delete(id);
  }
  for (const plugin of plugins) {
    await comm.get('register-search-provider')?.({ name: plugin.name }, plugin.id);
    registeredProviders.add(plugin.id);
  }
}
globalThis.songloft = {
  storage,
  log: { info() {}, warn() {}, error() {} }, // upstream diagnostics can contain signed URLs; never send them to Mono logs.
  plugin: { getHostUrl: async () => localBase, getToken: async () => token, getNetworkAddresses: async () => addresses() },
  songs: { list: o => library.songs(o), getById: id => library.songById(id), delete: async id => mono.library.removeTrack(await library.monoId(id)) },
  playlists: { list: () => library.playlists(), getById: id => library.playlist(id), getSongs: (id, o) => library.playlistSongs(id, o),
    addSongs: (id, ids) => library.editPlaylist(id, ids, true), removeSongs: (id, ids) => library.editPlaylist(id, ids, false) },
  comm: { onMessage: (name, fn) => comm.set(name, fn), call: async (target, name, value) => {
    if (target !== 'miot' || !comm.has(name)) throw new Error('不支持的插件通信');
    return comm.get(name)(value, 'mono');
  } },
};
// Audio links carry a media-only credential, never the settings/API credential.
globalThis.monoMediaToken = () => mediaToken;
globalThis.monoMediaProxy = source => {
  if (!/^https?:\/\//i.test(source)) throw new Error('不支持的播放地址');
  const id = randomBytes(16).toString('hex'); proxySources.set(id, source);
  if (proxySources.size > 256) proxySources.delete(proxySources.keys().next().value);
  return id;
};
const proxySources = new Map();
const detailCovers = new Map();
function authorized(req, url, expected) {
  return req.headers.authorization === `Bearer ${expected}` || url.searchParams.get('access_token') === expected;
}
function json(res, value, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
async function bodyOf(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 2 * 1024 * 1024) throw new Error('请求过大'); chunks.push(chunk); }
  return Buffer.concat(chunks).toString('utf8');
}
async function media(req, res, url) {
  if (!['GET', 'HEAD'].includes(req.method) || !authorized(req, url, mediaToken)) { res.writeHead(403); res.end(); return; }
  const match = /^\/api\/v1\/songs\/(-?\d+)\/(play|cover)$/.exec(url.pathname);
  if (match) {
    const trackId = await library.monoId(Number(match[1]));
    const track = match[2] === 'cover' ? await mono.library.getTrack(trackId) : null;
    const resource = match[2] === 'play' ? await mono.media.prepare(trackId) : track.artworkRef ? await mono.artwork.get(track.artworkRef) : null;
    const source = resource?.url;
    if (!source) { res.writeHead(404); res.end(); return; }
    await serveMedia(source, match[2] === 'cover' ? new URLSearchParams() : url.searchParams, req, res, ffmpeg); return;
  }
  if (url.pathname === '/api/v1/proxy/transcode') {
    const source = proxySources.get(url.searchParams.get('id'));
    if (!source) throw new Error('临时播放链接已过期');
    url.searchParams.set('format', 'mp3'); await serveMedia(source, url.searchParams, req, res, ffmpeg); return;
  }
  res.writeHead(404); res.end();
}
function guarded(handler) {
  return (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const url = new URL(req.url, 'http://127.0.0.1');
    normalizeMediaQuery(url);
    Promise.resolve(handler(req, res, url)).catch(error => {
      if (res.headersSent) res.destroy(); else json(res, { success: false, error: String(error.message || error) }, 500);
    });
  };
}
const mediaServer = http.createServer(guarded(media));
const controlServer = http.createServer(guarded(async (req, res, url) => {
  if (req.headers.host !== new URL(localBase).host) { res.writeHead(403); res.end(); return; }
  if (req.headers.origin === 'null') {
    res.setHeader('Access-Control-Allow-Origin', 'null');
    res.setHeader('Vary', 'Origin');
    if (req.headers['access-control-request-private-network'] === 'true') {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  }
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname.startsWith('/assets/') || url.pathname === '/icon.svg')) {
    if (url.pathname === '/') {
      const html = readFileSync(join(staticDir, 'index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' }); res.end(html); return;
    }
    const path = resolve(staticDir, '.' + decodeURIComponent(url.pathname));
    if (!path.startsWith(resolve(staticDir) + (process.platform === 'win32' ? '\\' : '/'))) { res.writeHead(403); res.end(); return; }
    // Static script/style MIME must be explicit with nosniff.
    const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : '';
    if (type) { res.writeHead(200, { 'Content-Type': type }); res.end(readFileSync(path)); } else await serveFile(path, req, res);
    return;
  }
  if (!authorized(req, url, token)) { res.writeHead(403); res.end(); return; }
  if (url.pathname === '/health') { json(res, { ready: true }); return; }
  if (url.pathname === prefix + '/track-details' && req.method === 'GET') {
    const id = Number(url.searchParams.get('song_id'));
    const trackId = await library.monoId(id);
    const publicTrack = await mono.library.getTrack(trackId);
    const track = { ...publicTrack, artist: publicTrack.artists, lyrics: await mono.lyrics.get(trackId),
      artwork: publicTrack.artworkRef ? (await mono.artwork.get(publicTrack.artworkRef)).url : null };
    if (track.artwork) {
      const key = randomBytes(16).toString('hex');
      detailCovers.set(key, track.artwork);
      if (detailCovers.size > 64) detailCovers.delete(detailCovers.keys().next().value);
      track.artwork = `${prefix}/detail-cover?id=${key}`;
    }
    json(res, { success: true, data: track }); return;
  }
  if (url.pathname === prefix + '/detail-cover' && ['GET', 'HEAD'].includes(req.method)) {
    const source = detailCovers.get(url.searchParams.get('id'));
    if (!source) { res.writeHead(404); res.end(); return; }
    await serveMedia(source, new URLSearchParams(), req, res, ffmpeg); return;
  }
  if (url.pathname.startsWith(prefix + '/')) {
    if (url.pathname === prefix + '/search-providers') await refreshProviders();
    const result = await globalThis.onHTTPRequest({ method: req.method, path: url.pathname.slice(prefix.length), query: url.search.slice(1), headers: req.headers, body: await bodyOf(req) });
    res.writeHead(result.statusCode || 200, result.headers); res.end(result.body); return;
  }
  if (url.pathname === '/api/v1/jsplugins/') {
    const plugins = await mono.sources.list(); json(res, { plugins: plugins.map(p => ({ entry_path: p.id, status: 'active' })) }); return;
  }
  const search = /^\/api\/v1\/jsplugin\/([^/]+)\/api\/search\/topone$/.exec(url.pathname);
  if (search && req.method === 'POST') {
    const input = JSON.parse(await bodyOf(req));
    const result = await mono.sources.search({ query: input.keyword, providerId: decodeURIComponent(search[1]), limit: 1 });
    const track = result.items?.[0];
    json(res, { code: track ? 0 : 1, msg: track ? 'OK' : '没有找到歌曲', data: track ? {
      title: track.title, artist: (track.artists || []).join(' / '), album: track.album, duration: track.duration,
      plugin_entry_path: track.source.providerId, source_data: track, dedup_key: String(track.source.sourceId) } : null }); return;
  }
  if (url.pathname === '/api/v1/songs/remote' && req.method === 'POST') {
    const input = JSON.parse(await bodyOf(req));
    const tracks = await mono.sources.importTracks(input.map(item => ({ providerId: item.plugin_entry_path, sourceId: item.dedup_key }))); await library.registerSongs(tracks);
    json(res, { count: tracks.length, songs: tracks.map(t => library.song(t)) }); return;
  }
  const edit = /^\/api\/v1\/playlists\/(\d+)\/songs$/.exec(url.pathname);
  if (edit && req.method === 'POST') { const input = JSON.parse(await bodyOf(req)); await library.editPlaylist(Number(edit[1]), input.song_ids, true); json(res, {}); return; }
  const song = /^\/api\/v1\/songs\/(-?\d+)\/(lyric|played|play|cover)$/.exec(url.pathname);
  if (song) {
    const id = Number(song[1]);
    if (song[2] === 'lyric') { const bundle = await mono.lyrics.get(await library.monoId(id)); json(res, { lyric: bundle.lyrics[0]?.content || '' }); return; }
    if (song[2] === 'played') { await mono.history.recordPlayed(await library.monoId(id)); json(res, {}); return; }
    // Host-side prefetch/URL checks use loopback, while speaker URLs use the LAN listener.
    url.searchParams.set('access_token', mediaToken); await media(req, res, url); return;
  }
  res.writeHead(404); res.end();
}));
const wss = new WebSocketServer({ noServer: true });
controlServer.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, localBase);
  if (req.headers.host !== new URL(localBase).host || !authorized(req, url, token) || !url.pathname.startsWith(prefix + '/')) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => {
    const adapter = { id: randomBytes(8).toString('hex'), OPEN: 1, get readyState() { return ws.readyState; },
      send: async data => { if (ws.readyState === 1) ws.send(data); }, close: async (code, reason) => ws.close(code, reason),
      onClose: fn => ws.on('close', (code, reason) => fn({ code, reason: reason.toString() })),
      onMessage: fn => ws.on('message', (data, isBinary) => fn({ data: isBinary ? data : data.toString(), isBinary })),
      onError: fn => ws.on('error', error => fn({ message: error.message })) };
    globalThis.onWebSocket({ path: url.pathname.slice(prefix.length), query: url.search.slice(1), headers: req.headers, method: 'GET', remoteAddr: '127.0.0.1' }, adapter).catch(() => ws.close(1011));
  });
});
async function listen(server, port, host) { await new Promise((ok, fail) => { server.once('error', fail); server.listen(port, host, ok); }); return server.address().port; }
mediaPort = await listen(mediaServer, Number(stored.mono_media_port || 17843), '0.0.0.0');
localBase = `http://127.0.0.1:${await listen(controlServer, 0, '127.0.0.1')}`;
await storage.set('mono_media_port', mediaPort);
const config = JSON.parse(await storage.get('config') || '{}');
if (!config.server_host) { config.server_host_mode = 'auto'; config.server_host = addresses()[0] || ''; await storage.set('config', JSON.stringify(config)); }
// Import only after the adapter globals have been installed.
await import('../src/main.ts');
await globalThis.onInit();
await refreshProviders();
process.stdout.write(JSON.stringify({ url: `${localBase}/#${token}` }) + '\n');
let stopping = false;
async function shutdown() {
  if (stopping) return; stopping = true;
  const deadline = setTimeout(() => process.exit(0), 8000); deadline.unref();
  stopMedia(); mono.dispose(); await globalThis.onDeinit?.(); wss.close(); controlServer.close(); mediaServer.close(); process.exit(0);
}
process.stdin.resume(); process.stdin.on('end', shutdown);
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
