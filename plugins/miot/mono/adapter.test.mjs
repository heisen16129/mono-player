import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { byteRange, serveFile, serveMedia } from './media.mjs';
import { pathToFileURL } from 'node:url';
import { Library } from './library.mjs';
import { mediaAddresses, resolveMediaHost } from './network.mjs';

test('media host defaults to automatic while explicit manual addresses stay unchanged', () => {
  const old = 'http://192.168.2.114:17843', current = 'http://192.168.2.108:17843';
  assert.equal(resolveMediaHost({ server_host: old, server_host_mode: 'auto' }, [current]), current);
  assert.equal(resolveMediaHost({ server_host: old, server_host_mode: 'manual' }, [current]), old);
  assert.equal(resolveMediaHost({ server_host: old }, [current]), current);
  assert.equal(resolveMediaHost({}, [current]), current);
  assert.equal(resolveMediaHost({ server_host: old, server_host_mode: 'auto' }, []), '');
  assert.deepEqual(mediaAddresses({ net: [
    { family: 'IPv4', address: '169.254.1.2', internal: false },
    { family: 'IPv4', address: '127.0.0.1', internal: true },
    { family: 'IPv4', address: '192.168.2.108', internal: false },
  ] }, 17843), [current]);
});
import { normalizeMediaQuery } from './request-url.mjs';
import { execFileSync } from 'node:child_process';

test('speaker firmware query rewriting preserves seek and validates the entire credential', () => {
  const token = 'a'.repeat(64);
  const url = new URL(`http://localhost/api/v1/songs/1/play?access_token=${token}%20seek=172%20speed=1.5`);
  normalizeMediaQuery(url);
  assert.equal(url.searchParams.get('access_token'), token);
  assert.equal(url.searchParams.get('seek'), '172');
  assert.equal(url.searchParams.get('speed'), '1.5');
  const invalid = new URL(`http://localhost/api/v1/songs/1/play?access_token=${token}%20unexpected=1`);
  normalizeMediaQuery(invalid);
  assert.notEqual(invalid.searchParams.get('access_token'), token);
});

test('real FFmpeg generates audio after a seek', async () => {
  const ffmpeg = resolve('plugins/miot/dist/ffmpeg.exe');
  const dir = mkdtempSync(join(tmpdir(), 'mono-miot-seek-'));
  const file = join(dir, '测试.wav');
  execFileSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', file], { windowsHide: true });
  const server = http.createServer((req, res) => {
    serveMedia(file, new URLSearchParams('seek=1'), req, res, ffmpeg).catch(() => { res.writeHead(500); res.end(); });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/play`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.ok((await response.arrayBuffer()).byteLength > 1000);
  } finally { server.closeAllConnections(); server.close(); }
});

test('WASM manifest and service plan match the host allowlist', async () => {
  const { instance } = await WebAssembly.instantiate(readFileSync(new URL('../dist/miot.wasm', import.meta.url)));
  const { memory, mono_alloc, mono_dealloc, mono_invoke, mono_last_len } = instance.exports;
  const invoke = request => {
    const bytes = Buffer.from(JSON.stringify(request)); const ptr = mono_alloc(bytes.length);
    new Uint8Array(memory.buffer, ptr, bytes.length).set(bytes);
    const out = mono_invoke(ptr, bytes.length); const length = mono_last_len();
    const result = JSON.parse(Buffer.from(memory.buffer, out, length).toString());
    mono_dealloc(ptr, bytes.length); mono_dealloc(out, length); return result;
  };
  const metadata = invoke({ action: 'metadata' }).data;
  assert.equal(metadata.id, 'mono-wasm-miot');
  assert.deepEqual(metadata.permissions, ['network', 'speaker-service']);
  assert.deepEqual(metadata.capabilities, ['speaker-control']);
  assert.deepEqual(invoke({ action: 'speaker_service', command: 'ignored' }).data, { engine: 'mono-miot' });
  assert.equal(invoke({ action: 'exec' }).code, 0);
});

test('local cover file URLs with Chinese names and spaces are served as images', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mono-miot-cover-'));
  const file = join(dir, '封面 赵雷.jpg');
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]); writeFileSync(file, bytes);
  const server = http.createServer((req, res) => {
    serveMedia(pathToFileURL(file).href, new URLSearchParams(), req, res, '').catch(() => { res.writeHead(500); res.end(); });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/cover`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  } finally { server.closeAllConnections(); server.close(); }
});

test('HTTP Range supports speaker seeking and rejects malformed/out-of-bounds requests', async () => {
  assert.deepEqual(byteRange('bytes=2-5', 10), { start: 2, end: 5 });
  assert.deepEqual(byteRange('bytes=-3', 10), { start: 7, end: 9 });
  for (const value of ['bytes=10-', 'bytes=6-2', 'bytes=-0', 'bytes=0-1,3-4']) assert.throws(() => byteRange(value, 10));
  const dir = mkdtempSync(join(tmpdir(), 'mono-miot-range-')); const file = join(dir, '测试.mp3');
  writeFileSync(file, '0123456789');
  const server = http.createServer((req, res) => serveFile(file, req, res));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(url, { headers: { Range: 'bytes=2-5' } });
    assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), 'bytes 2-5/10'); assert.equal(await response.text(), '2345');
    const head = await fetch(url, { method: 'HEAD' }); assert.equal(head.headers.get('content-length'), '10'); assert.equal(await head.text(), '');
    assert.equal((await fetch(url, { headers: { Range: 'bytes=99-' } })).status, 416);
  } finally { server.closeAllConnections(); server.close(); }
});

test('library and custom playlist ordering follow Mono rather than numeric song IDs', async () => {
  const values = {};
  const data = { tracks: [{ id: 30, title: '雨蝶' }, { id: 2, title: '当' }, { id: 17, title: '董小姐' }], favorites: { ids: [17, 30] }, playlists: [{ id: 'custom', name: '歌单', trackIds: [2, 30, 17] }] };
  const library = new Library(async () => data, { get: async k => values[k], set: async (k, v) => { values[k] = v; } });
  const lists = await library.playlists();
  const titles = async key => (await library.playlistSongs(lists.find(p => p.monoId === key).id)).map(s => s.title);
  assert.deepEqual(await titles('__all'), ['雨蝶', '当', '董小姐']);
  assert.deepEqual(await titles('__favorites'), ['董小姐', '雨蝶']);
  assert.deepEqual(await titles('custom'), ['当', '雨蝶', '董小姐']);
});

test('startup requests share one snapshot and playlist edits invalidate cached data', async () => {
  let reads = 0; const values = {};
  const library = new Library(async method => {
    if (method !== 'snapshot') return {};
    reads++;
    await new Promise(resolve => setTimeout(resolve, 5));
    return { tracks: [{ id: 7, title: '成都' }], favorites: { ids: [7] }, playlists: [] };
  }, { get: async k => values[k], set: async (k, v) => { values[k] = v; } }, 1000);
  await Promise.all([library.playlists(), library.songs(), library.playlists()]);
  await library.playlistSongs(1);
  assert.equal(reads, 1);
  await library.editPlaylist(1, [1], false);
  await library.snapshot();
  assert.equal(reads, 2);
});

test('playlist counts match actual songs despite stale and duplicate saved IDs', async () => {
  const values = {};
  const data = { tracks: [{ id: 1, title: '歌曲' }], favorites: { ids: [1, 1, 99] }, playlists: [{ id: 'list', name: '歌单', trackIds: [99, 1, 1] }] };
  const library = new Library(async () => data, { get: async k => values[k], set: async (k, v) => { values[k] = v; } });
  for (const list of await library.playlists()) {
    assert.equal(list.song_count, 1);
    assert.equal((await library.playlistSongs(list.id)).length, list.song_count);
  }
  data.favorites.ids = [99];
  const favorites = (await library.playlists())[0];
  assert.equal(favorites.song_count, 0);
  assert.deepEqual(await library.playlistSongs(favorites.id), []);
});

test('Mono playlist IDs stay stable after reorder; Chinese metadata and favorites survive mapping', async () => {
  const values = {}; const storage = { get: async k => values[k], set: async (k, v) => { values[k] = v; } };
  const snapshot = { tracks: [{ id: 7, title: '成都', artist: ['赵雷'], path: 'D:/音乐/成都.flac' }], favorites: { ids: [7] }, playlists: [{ id: 'abc', name: '中文歌单', trackIds: [7] }] };
  const library = new Library(async () => snapshot, storage);
  const playlists = await library.playlists(); const id = playlists.find(p => p.monoId === 'abc').id;
  assert.equal(playlists[0].id, 1); assert.equal(playlists[0].type, 'normal'); assert.equal(playlists[0].monoId, '__favorites');
  snapshot.playlists.unshift({ id: 'new', name: '新歌单', trackIds: [] });
  assert.equal((await library.playlists()).find(p => p.monoId === 'abc').id, id);
  const songs = await library.playlistSongs(id); assert.equal(songs[0].title, '成都'); assert.equal(songs[0].artist, '赵雷');
  assert.equal(songs[0].url, '/api/v1/songs/1/play');
  snapshot.tracks.push({ id: -7, title: '在线歌曲', artist: ['歌手'] });
  const all = await library.songs(); assert.notEqual(all[0].id, all[1].id);
  assert.ok(all.every(s => s.id > 0)); assert.equal(await library.monoId(all[1].id), -7);
});

test('Full service starts, protects APIs, persists groups/settings and shuts down on host exit', { timeout: 30000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mono-miot-service-'));
  const coverFile = join(dir, '歌曲 封面.jpg');
  const coverBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  writeFileSync(coverFile, coverBytes);
  let detailCalls = 0;
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({ mono_media_port: '0' }));
  const bridge = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const { method } = JSON.parse(body);
    assert.equal(req.headers['x-mono-mcp-token'], 'fixture');
    if (method === 'miot.track_details') detailCalls++;
    const payload = method === 'miot.track_details' ? { id: 7, title: '成都', artist: ['赵雷'], artwork: pathToFileURL(coverFile).href, lyrics: { lyrics: [{ format: 'lrc', content: '[00:01]歌词' }] } }
      : method === 'miot.cover' ? `http://asset.localhost/${encodeURIComponent(coverFile.replaceAll('\\', '/'))}`
      : method === 'miot.plugins' ? [{ id: 'test-source', name: '测试音源' }]
      : { tracks: [{ id: 7, title: '成都', artist: ['赵雷'] }], favorites: { ids: [] }, playlists: [] };
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, payload }));
  });
  bridge.listen(0, '127.0.0.1'); await once(bridge, 'listening');
  const bridgeFile = join(dir, 'bridge.json'); writeFileSync(bridgeFile, JSON.stringify({ port: bridge.address().port, token: 'fixture' }));
  let child;
  async function launch() {
    child = spawn(process.execPath, [resolve('plugins/miot/dist/service.mjs'), bridgeFile, dir, resolve('plugins/miot/dist/web')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let errors = ''; child.stderr.on('data', b => { errors += b; });
    const output = createInterface({ input: child.stdout });
    const value = await Promise.race([once(output, 'line').then(([line]) => JSON.parse(line)), once(child, 'exit').then(([code]) => { throw new Error(`service exited ${code}: ${errors}`); })]);
    const url = new URL(value.url); const token = url.hash.slice(1); url.hash = '';
    const request = async (path, body) => {
      const response = await fetch(`${url.origin}/api/v1/jsplugin/miot${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      return response.json();
    };
    return { url, token, request };
  }
  try {
    let { url, token, request } = await launch();
    assert.equal((await fetch(`${url.origin}/api/v1/jsplugin/miot/accounts`)).status, 403);
    assert.equal((await fetch(url)).status, 200);
    const html = await (await fetch(url)).text(); assert.match(html, /SongloftPlugin/); assert.ok(!html.includes(token));
    const asset = html.match(/src="([^"]+\.js)"/)[1]; assert.equal((await fetch(`${url.origin}${asset}`)).headers.get('content-type'), 'text/javascript');
    assert.equal((await request('/accounts')).success, true);
    const details = await request('/track-details?song_id=1');
    assert.equal(details.data.id, 7);
    assert.deepEqual(details.data.artist, ['赵雷']);
    assert.equal(details.data.lyrics.lyrics[0].content, '[00:01]歌词');
    const original = await fetch(`${url.origin}${details.data.artwork}&access_token=${token}`);
    assert.equal(original.status, 200);
    assert.deepEqual(Buffer.from(await original.arrayBuffer()), coverBytes);
    assert.equal(detailCalls, 1);
    const cover = await fetch(`${url.origin}/api/v1/songs/1/cover?access_token=${token}&w=96`);
    assert.equal(cover.status, 200);
    assert.equal(cover.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(Buffer.from(await cover.arrayBuffer()), coverBytes);
    const config = await request('/config'); assert.equal(config.success, true);
    const providers = await request('/search-providers'); assert.equal(providers.providers[0].id, 'test-source');
    const group = await request('/groups', { name: '客厅与卧室', members: [{ account_id: 'a', device_id: 'pro' }, { account_id: 'a', device_id: 'gen2' }] });
    assert.equal(group.success, true); assert.equal(group.data.name, '客厅与卧室');
    const invalid = await request('/groups', { name: '', members: [] }); assert.equal(invalid.success, false);
    const voices = await request('/voice-commands'); assert.equal(voices.success, true);
    const tasks = await request('/schedules'); assert.equal(tasks.success, true);
    const mediaPort = JSON.parse(readFileSync(join(dir, 'settings.json'))).mono_media_port;
    assert.equal((await fetch(`http://127.0.0.1:${mediaPort}/api/v1/jsplugin/miot/accounts?access_token=${token}`)).status, 403);
    const exit = once(child, 'exit'); child.stdin.end(); await exit;
    ({ request } = await launch());
    assert.equal((await request('/groups')).data[0].name, '客厅与卧室');
    const stopped = once(child, 'exit'); child.stdin.end(); await stopped;
  } finally { child?.kill(); bridge.closeAllConnections(); bridge.close(); }
});
