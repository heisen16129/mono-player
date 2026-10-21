import assert from 'node:assert/strict';
import test from 'node:test';
import { installCompat } from './compat.mjs';
import { QRCodeLogin } from '../src/qrcode/qrcode';
import { MinaHTTPClient } from '../src/mina/client';
import { ConfigManager } from '../src/config/manager';
import { Scheduler } from '../src/schedule/scheduler';
import { URLBuilder } from '../src/player/url_builder';
import { setHostBaseUrl } from '../src/utils/http';
import { findFavoritesPlaylist } from '../src/utils/favorites';
import { Library } from './library.mjs';
import { VoiceEngine } from '../src/voicecmd/engine';
import { GroupCoordinator } from '../src/group/coordinator';
import { PlaylistManagerMap } from '../src/player/manager';

test('shutdown stops active queues once, isolates failures and cleans idle managers', async () => {
  const calls: string[] = [];
  const make = (id: string, state: string) => ({
    getStatus: () => ({ state, current_song: { id: 1 } }),
    cleanup: () => calls.push(`clean:${id}`),
    stop: async () => { calls.push(`stop:${id}`); if (id === 'offline') throw Error('offline'); },
  });
  const active = make('active', 'playing');
  const map = Object.create(PlaylistManagerMap.prototype);
  map.managers = new Map([['a', active], ['group', active], ['b', make('offline', 'paused')], ['c', make('idle', 'stopped')]]);
  await map.stopForShutdown();
  assert.equal(calls.filter(c => c === 'stop:active').length, 1);
  assert.ok(calls.includes('stop:offline'));
  assert.ok(!calls.includes('stop:idle'));
  assert.equal(map.managers.size, 0);
});

installCompat();
const stored = new Map();
globalThis.songloft = { log: { info() {}, warn() {}, error() {} },
  storage: { get: async key => stored.get(key), set: async (key, value) => stored.set(key, value) },
  plugin: { getToken: async () => 'private-control-token' } } as any;
globalThis.monoMediaToken = () => 'media-only-token';
const response = (value: unknown, headers = {}) => new Response(JSON.stringify(value), { headers });

test('QR login exchanges Xiaomi passToken and follows redirects with cookies intact', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input)); calls.push(url.pathname);
    if (url.pathname === '/pass/serviceLogin' && url.searchParams.get('sid') === 'mijia') return response({ _sign: 'sign', qs: 'qs', callback: 'https://account.xiaomi.com/callback' });
    if (url.pathname === '/longPolling/loginUrl') return response({ code: 0, qr: 'https://account.xiaomi.com/qr', loginUrl: 'https://account.xiaomi.com/login', lp: 'https://account.xiaomi.com/poll' });
    if (url.pathname === '/poll') return response({ code: 0, passToken: 'fixture-pass', userId: '123', cUserId: 'encrypted' });
    if (url.pathname === '/pass/serviceLogin') {
      assert.match(String(options?.headers?.['Cookie']), /passToken=fixture-pass/);
      return response({ code: 0, location: 'https://account.xiaomi.com/sts', userId: '123', nonce: 12345, ssecurity: 'fixture-security' });
    }
    if (url.pathname === '/sts') return new Response('', { status: 302, headers: { Location: '/finish', 'Set-Cookie': 'redirectCookie=ok; Path=/' } });
    if (url.pathname === '/finish') {
      assert.match(String(options?.headers?.['Cookie']), /redirectCookie=ok/);
      return response({}, { 'Set-Cookie': 'serviceToken=fixture-service; Path=/' });
    }
    throw new Error('Unexpected request ' + url.pathname);
  };
  try {
    const qr = new QRCodeLogin(); assert.ok(await qr.getQRCode());
    const result = await qr.poll(); assert.equal(result.state, 'confirmed', result.message);
    assert.equal(result.tokenInfo?.services.micoapi.service_token, 'fixture-service');
    assert.ok(calls.includes('/finish'));
  } finally { globalThis.fetch = original; }
});

test('hardware selection and actual device failure responses are preserved', async () => {
  const original = globalThis.fetch; const sent: URLSearchParams[] = []; let reject = false;
  globalThis.fetch = async (_input, options) => {
    sent.push(new URLSearchParams(String(options?.body || '')));
    return response({ code: 0, data: { code: reject ? -1 : 0, info: JSON.stringify({ status: 1 }) } });
  };
  try {
    const client = new MinaHTTPClient({ user_id: '123', device_id: 'fixture', services: { micoapi: { service_token: 'fixture', ssecurity: '', expires_at: Date.now() + 60000 } }, created_at: '', expires_at: '' });
    assert.equal(await client.playByUrl('pro', 'http://192.168.1.2/test.mp3', 'LX06'), true);
    assert.equal(sent[0].get('method'), 'player_play_music');
    assert.equal(await client.playByUrl('gen2', 'http://192.168.1.2/test.mp3', 'UNKNOWN'), true);
    assert.equal(sent[1].get('method'), 'player_play_url');
    reject = true; assert.equal(await client.playerPause('pro'), false);
  } finally { globalThis.fetch = original; }
});

test('speaker URL contains only media credential; local API checks use control credential', async () => {
  setHostBaseUrl('http://192.168.1.20:17843');
  const url = await URLBuilder.buildSongURL({ id: 7, url: '/api/v1/songs/7/play' }, { seekSeconds: 30, speed: 1.5, forceMp3: true });
  assert.ok(!url.includes('private-control-token')); assert.match(url, /access_token=media-only-token/);
  assert.match(url, /seek=30/); assert.match(url, /speed=1.5/);
  const local = await URLBuilder.buildSongURL({ id: 7, url: '/api/v1/songs/7/play' }, { baseUrl: 'http://127.0.0.1:10000' });
  assert.match(local, /access_token=private-control-token/);
});

test('scheduler executes due weekly tasks once per minute', async () => {
  const config = new ConfigManager(); const now = new Date();
  await config.saveConfig({ ...(await config.getConfig()), timezone: 'Asia/Shanghai' });
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value || '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday'));
  await config.addScheduledTask({ id: 'fixture-task', name: '定时测试', enabled: true, action: 'stop', schedule: { type: 'weekly', time: `${part('hour')}:${part('minute')}`, weekdays: [day], holiday_mode: 'ignore' }, target: { all_managed: true }, params: {}, created_at: '', updated_at: '' } as any);
  const calls: any[] = []; const scheduler = new Scheduler(config, { execute: async task => { calls.push(task); return []; } } as any);
  (scheduler as any).enabled = true;
  await (scheduler as any).tick(); await (scheduler as any).tick();
  scheduler.stop(); assert.equal(calls.length, 1);
});

test('voice commands distinguish song names, playlist names and playback controls', async () => {
  const config = new ConfigManager();
  const engine = new VoiceEngine(config, {} as any, {} as any, {} as any, {} as any);
  for (const [query, type, argument] of [['播放歌曲成都', 'play_song', '成都'], ['播放歌单我的歌单', 'play_playlist', '我的歌单'], ['下一首', 'next', '']]) {
    const match = await (engine as any).matchCommand(query);
    assert.equal(match?.command.type, type); assert.equal(match?.argument, argument);
  }
});

test('natural artist requests respect disabled commands and explicit song names', async () => {
  const commands = [
    { type: 'play_artist', keywords: ['播放歌手'], enabled: true },
    { type: 'play_song', keywords: ['播放歌曲', '我想听'], enabled: true },
    { type: 'play_playlist', keywords: ['播放歌单'], enabled: true },
  ];
  const engine = new VoiceEngine({ getVoiceCommands: async () => commands } as any, {} as any, {} as any, {} as any, {} as any);
  for (const query of ['播放许嵩的歌', '我想听许嵩的歌曲', '放许嵩的歌！', '我要听许嵩的歌']) {
    const match = await (engine as any).matchCommand(query);
    assert.equal(match.command.type, 'play_artist'); assert.equal(match.argument, '许嵩');
  }
  assert.equal((await (engine as any).matchCommand('播放歌曲妈妈的歌')).command.type, 'play_song');
  assert.equal((await (engine as any).matchCommand('播放歌单许嵩的歌')).command.type, 'play_playlist');
  assert.equal(await (engine as any).matchCommand('播放许嵩的歌', new Set(['next'])), null);
  commands[0].enabled = false;
  assert.equal(await (engine as any).matchCommand('播放许嵩的歌'), null);
});

test('artist requests bypass old song memories on repeated requests; song requests retain memory', async () => {
  const engine: any = new VoiceEngine(new ConfigManager(), {} as any, {} as any, {} as any, {} as any);
  engine.enabled = true;
  engine.extractQuery = (msg: any) => msg.query;
  engine.findAccountForDevice = async () => 'account';
  engine.configManager.getConfig = async () => ({ voice_memory_enabled: true, voice_memory_max_records: 100 });
  engine.memoryService.setMaxRecords = async () => {};
  let memoryCalls = 0;
  engine.tryHandleMemory = async () => { memoryCalls++; return true; };
  engine.queueMemorySuccess = () => assert.fail('Artist requests must not save a single-song memory');
  const executed: any[] = [];
  engine.executeCommand = async (match: any) => { executed.push(match); return { songName: '素颜', artist: '许嵩' }; };
  for (let i = 0; i < 2; i++) await engine.handleMessage({ device_id: 'speaker', query: '播放许嵩的歌' });
  assert.equal(memoryCalls, 0);
  assert.deepEqual(executed.map(m => [m.command.type, m.argument]), [['play_artist', '许嵩'], ['play_artist', '许嵩']]);
  await engine.handleMessage({ device_id: 'speaker', query: '播放歌曲素颜' });
  assert.equal(memoryCalls, 1);
  assert.equal(executed.length, 2);
});

test('AI artist requests do not create single-song memories', async () => {
  const engine: any = new VoiceEngine(new ConfigManager(), {} as any, {} as any, {} as any, {} as any);
  engine.enabled = true;
  engine.extractQuery = () => '来几首许嵩';
  engine.findAccountForDevice = async () => 'account';
  engine.matchCommand = async () => null;
  engine.configManager.getConfig = async () => ({ voice_memory_enabled: true, voice_memory_max_records: 100 });
  engine.configManager.getAIConfig = async () => ({ enabled: true });
  engine.memoryService.setMaxRecords = async () => {};
  engine.tryHandleMemory = async () => false;
  engine.aiAnalyzer.analyze = async () => ({ action: 'play_artist', confidence: 'high', params: { artist: '许嵩' } });
  let executed = false;
  engine.executeAIResult = async () => { executed = true; return { songName: '素颜', artist: '许嵩' }; };
  engine.queueMemorySuccess = () => assert.fail('AI artist requests must not save a single-song memory');
  await engine.handleMessage({ device_id: 'speaker' });
  assert.equal(executed, true);
});

test('group commands reach the other speaker; one unavailable speaker does not block peers', async () => {
  const members = [{ account_id: 'a', device_id: 'pro' }, { account_id: 'a', device_id: 'gen2' }, { account_id: 'a', device_id: 'offline' }];
  const calls: string[] = [];
  const coordinator = new GroupCoordinator({} as any, { setVolume: async (_a, d) => { calls.push(d); if (d === 'offline') throw Error('offline'); } } as any,
    { findDeviceGroup: async () => ({ members }) } as any);
  await coordinator.fanOutSetVolume('a', 'pro', 30);
  assert.deepEqual(calls.sort(), ['gen2', 'offline']);
});

test('upstream favorites detection resolves Mono favorites, never the entire library', async () => {
  const storage = { get: async () => null, set: async () => {} };
  const library = new Library({ library: { listTracks: async () => ({ items: [] }) }, favorites: { list: async () => ({ items: [] }) }, playlists: { list: async () => ({ items: [] }) } }, storage);
  assert.equal(findFavoritesPlaylist(await library.playlists())?.monoId, '__favorites');
});
