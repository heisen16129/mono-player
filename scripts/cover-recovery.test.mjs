import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['src/services/coverRecovery.ts'], bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'cover-mocks', setup(builder) {
    builder.onLoad({ filter: /services[\\/]music\.ts$/ }, () => ({ contents: 'export const readTrackCoverOriginal = (path) => globalThis.readCover(path);' }));
  } }],
});
const { recoverTrackCover } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const track = () => ({ path: 'C:/music/song.mp3', artwork: 'http://asset.localhost/C%3A%2Fcache%2Fcover-thumbnails%2Fmissing.jpg' });

test('missing thumbnail recovers and concurrent views share the read', async () => {
  let calls = 0;
  globalThis.readCover = async () => { calls++; return 'C:/cache/cover-originals/restored.jpg'; };
  const first = track(), second = track();
  await Promise.all([recoverTrackCover(first), recoverTrackCover(second)]);
  assert.equal(calls, 1);
  assert.equal(first.artwork, 'file:///C:/cache/cover-originals/restored.jpg');
  assert.equal(second.artwork, first.artwork);
  assert.ok(first.coverVersion);
});

test('late recovery does not overwrite a newly selected cover', async () => {
  let finish;
  globalThis.readCover = () => new Promise(resolve => { finish = resolve; });
  const selected = track();
  const pending = recoverTrackCover(selected);
  selected.artwork = 'file:///custom.jpg';
  finish('C:/cache/restored.jpg');
  await pending;
  assert.equal(selected.artwork, 'file:///custom.jpg');
});

test('remote artwork and failed recovery remain unchanged', async () => {
  globalThis.readCover = async () => { throw Error('missing source'); };
  const selected = track();
  const original = selected.artwork;
  await recoverTrackCover(selected);
  assert.equal(selected.artwork, original);
  globalThis.readCover = () => assert.fail('remote cover must not be replaced');
  await recoverTrackCover({ ...track(), artwork: 'https://example.com/cover.jpg' });
});
