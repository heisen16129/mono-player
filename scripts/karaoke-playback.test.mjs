import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const mocks = {
  plugins: `export async function listInstalledPlugins(){return [{id:'stem',enabled:true,kind:'tool',capabilities:['stem-separation']}];}`,
  playerBackend: `export async function listenRustBackendState(fn){globalThis.karaokeMocks.listener=fn;return ()=>{};}`,
  karaoke: `export async function resolveKaraokePlaybackSource(...args){return globalThis.karaokeMocks.resolve(...args)}; export function prepareKaraoke(...args){return args[2] ? globalThis.karaokeMocks.lookup() : globalThis.karaokeMocks.prepare(...args)}; export async function switchKaraoke(...args){globalThis.karaokeMocks.switched.push(args)}`,
  stemSeparation: `export async function checkStemEnvironment(){globalThis.karaokeMocks.checks++;return {stage:'ready'}}; export async function prepareStemEnvironment(){throw Error('unexpected install')}; export async function readStemEnvironment(){return {stage:'ready'}}; export async function readStemSeparationStatus(){return globalThis.karaokeMocks.job}; export async function cancelStemSeparation(id){globalThis.karaokeMocks.cancelled.push(id)}`,
  useMusicSourcePluginAvailability: `export const PLUGINS_CHANGED_EVENT='plugins-changed';`,
};
const bundle = await build({
  stdin: { contents: `export {createRenderer,ref,nextTick} from 'vue'; export {useKaraokePlayback} from './src/composables/useKaraokePlayback';`, resolveDir: fileURLToPath(new URL('../', import.meta.url)) },
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'karaoke-mocks', setup(builder) {
    builder.onLoad({ filter: /(?:plugins|playerBackend|karaoke|stemSeparation|useMusicSourcePluginAvailability)\.ts$/ }, ({ path }) => {
      const key = path.split(/[\\/]/).at(-1).replace('.ts', '');
      return mocks[key] ? { contents: mocks[key], loader: 'ts' } : undefined;
    });
  } }],
});
const { createRenderer, ref, nextTick, useKaraokePlayback } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
globalThis.window = new EventTarget();
const flush = () => new Promise(resolve => setImmediate(resolve));
function mount() {
  globalThis.karaokeMocks = { switched: [], cancelled: [], resolve: async (source) => source, prepare: async () => ({ accompaniment: 'stem.wav', job: null }) };
  globalThis.karaokeMocks.lookup = async () => ({ accompaniment: null, job: null });
  globalThis.karaokeMocks.checks = 0;
  const source = ref('song.wav');
  const track = ref(null);
  let controls;
  const renderer = createRenderer({ createComment: () => ({}), createElement: () => ({}), createText: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, parentNode() {}, nextSibling() {}, patchProp() {} });
  const app = renderer.createApp({ setup() { controls = useKaraokePlayback(source, track); return () => null; } });
  app.mount({});
  return { controls, source, track, app };
}

test('cached accompaniment switches both ways without installation', async () => {
  const { controls, app } = mount();
  await flush();
  globalThis.karaokeMocks.lookup = async () => ({ accompaniment: 'stem.wav', job: null });
  globalThis.karaokeMocks.prepare = async () => { assert.fail('cached accompaniment must not be regenerated'); };
  await controls.select('karaoke');
  assert.equal(globalThis.karaokeMocks.checks, 0);
  assert.equal(controls.mode.value, 'karaoke');
  await controls.select('original');
  assert.equal(controls.mode.value, 'original');
  assert.deepEqual(globalThis.karaokeMocks.switched, [['stem','song.wav','stem.wav'], ['stem','song.wav',null]]);
  app.unmount();
});

test('missing accompaniment is generated and switched automatically when ready', async () => {
  const { controls, app } = mount();
  await flush();
  let starts = 0;
  globalThis.karaokeMocks.prepare = async () => {
    starts++;
    return { accompaniment: null, job: { id: 'generated-job' } };
  };
  globalThis.karaokeMocks.job = { id: 'generated-job', stage: 'done', accompanimentPath: 'new-stem.wav' };
  await controls.select('karaoke');
  assert.equal(starts, 1);
  assert.equal(globalThis.karaokeMocks.checks, 1);
  assert.equal(controls.mode.value, 'karaoke');
  assert.deepEqual(globalThis.karaokeMocks.switched, [['stem', 'song.wav', 'new-stem.wav']]);
  app.unmount();
});

for (const action of ['cancel', 'change-song']) test(`${action} prevents late preparation from changing playback`, async () => {
  const { controls, source, app } = mount();
  await flush();
  let finish;
  globalThis.karaokeMocks.prepare = () => new Promise(resolve => { finish = resolve; });
  const pending = controls.select('karaoke');
  await flush();
  if (action === 'cancel') await controls.select('original');
  else { source.value = 'next.wav'; await nextTick(); }
  finish({ accompaniment: null, job: { id: 'old-job' } });
  await pending;
  assert.equal(controls.mode.value, 'original');
  assert.equal(controls.preparing.value, false);
  assert.deepEqual(globalThis.karaokeMocks.switched, []);
  assert.deepEqual(globalThis.karaokeMocks.cancelled, ['old-job']);
  app.unmount();
});

test('preparation failure leaves original playback and shows the reason', async () => {
  const { controls, app } = mount();
  await flush();
  globalThis.karaokeMocks.prepare = async () => { throw Error('cache incomplete'); };
  await controls.select('karaoke');
  assert.equal(controls.mode.value, 'original');
  assert.equal(controls.preparing.value, false);
  assert.equal(controls.message.value, 'cache incomplete');
  assert.deepEqual(globalThis.karaokeMocks.switched, []);
  app.unmount();
});

test('selecting karaoke does not start an unloaded song', async () => {
  const { controls, app } = mount();
  await flush();
  let loaded = false;
  let preparations = 0;
  globalThis.karaokeMocks.resolve = async () => loaded ? 'D:\\Music\\song.wav' : null;
  globalThis.karaokeMocks.prepare = async (_plugin, source) => {
    preparations++;
    assert.equal(source, 'D:\\Music\\song.wav');
    return { accompaniment: 'stem.wav', job: null };
  };
  const pending = controls.select('karaoke');
  await flush();
  assert.equal(controls.label.value, 'K歌已选');
  assert.equal(preparations, 0);
  assert.match(controls.message.value, /不会主动开始播放/);
  assert.equal(loaded, false);
  loaded = true;
  await pending;
  assert.equal(preparations, 1);
  assert.equal(controls.mode.value, 'karaoke');
  assert.deepEqual(globalThis.karaokeMocks.switched, [['stem', 'D:\\Music\\song.wav', 'stem.wav']]);
  app.unmount();
});

test('resolving an online URL does not cancel the same song selection', async () => {
  const { controls, source, track, app } = mount();
  track.value = { sourceProviderId: 'provider', sourceId: 'song' };
  source.value = 'plugin://provider/song';
  await nextTick();
  await flush();
  let loaded = false;
  globalThis.karaokeMocks.resolve = async (_source, provider, id) => {
    assert.equal(provider, 'provider'); assert.equal(id, 'song');
    return loaded ? 'https://audio/resolved' : null;
  };
  const pending = controls.select('karaoke');
  await flush();
  source.value = 'https://audio/resolved';
  loaded = true;
  await nextTick();
  await pending;
  assert.equal(controls.mode.value, 'karaoke');
  assert.deepEqual(globalThis.karaokeMocks.switched, [['stem', 'https://audio/resolved', 'stem.wav']]);
  app.unmount();
});

test('original cancels a waiting selection before any separation is started', async () => {
  const { controls, app } = mount();
  await flush();
  globalThis.karaokeMocks.resolve = async () => null;
  globalThis.karaokeMocks.prepare = async () => { assert.fail('must not prepare'); };
  const pending = controls.select('karaoke');
  await flush();
  await controls.select('original');
  await pending;
  assert.equal(controls.label.value, '原声');
  assert.equal(controls.message.value, '');
  assert.deepEqual(globalThis.karaokeMocks.switched, []);
  app.unmount();
});
