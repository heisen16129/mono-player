import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync('plugin/miot/ui/frontend/src/views/FullscreenPlayer.vue', 'utf8');
const loader = source.slice(source.indexOf('async function loadSongDetails'), source.indexOf('// 全屏播放器里的'));
function setup(parse) {
  const context = {
    detailRequest: 0, detailSong: { value: null }, lyrics: { value: [] }, isFavorite: { value: false },
    state: { player: { current_song: { id: 1 } } },
    get: async path => path.includes('track-details')
      ? { lyrics: { lyrics: [{ format: 'yrc', content: 'word lyrics' }] } }
      : { is_favorited: true },
    mono: { lyrics: { parse } }, notify: () => {}, messageOf: String,
  };
  const js = ts.transpileModule(loader, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  context.load = runInNewContext(`${js}; loadSongDetails`, context);
  return context;
}
test('Miot uses public lyrics parsing and preserves the host result', async () => {
  const lines = [{ time: null, text: '标题' }, { time: 1, text: '词', words: [{ time: 1, duration: 0.5, text: '词' }] }];
  let input;
  const context = setup(async params => { input = params; return lines; });
  await context.load();
  assert.equal(input.format, 'yrc'); assert.equal(input.content, 'word lyrics');
  assert.equal(context.lyrics.value, lines);
  assert.equal(context.isFavorite.value, true);
});
test('lyrics from a previous song cannot overwrite a new song while parsing is pending', async () => {
  let complete, started;
  const parsing = new Promise(resolve => { started = resolve; });
  const context = setup(() => { started(); return new Promise(resolve => { complete = resolve; }); });
  const load = context.load(); await parsing;
  context.state.player.current_song.id = 2;
  context.lyrics.value = [{ time: 0, text: 'new song' }];
  complete([{ time: 0, text: 'old song' }]); await load;
  assert.equal(context.lyrics.value[0].text, 'new song');
});
