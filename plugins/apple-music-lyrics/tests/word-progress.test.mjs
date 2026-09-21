import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('line changes complete trailing words and seeking backward resets future words', () => {
  const source = readFileSync(new URL('../renderer.mjs', import.meta.url), 'utf8');
  const functions = source.slice(source.indexOf('function updateLyricState()'), source.indexOf('function getActiveLyricScrollTarget()'));
  const makeLine = (time, duration) => {
    const word = { dataset: { time, duration }, style: { setProperty(_, value) { this.progress = value; } } };
    return { word, classList: { toggle() {} }, style: {}, querySelectorAll: () => [word] };
  };
  const nodes = [makeLine(0, 1), makeLine(1, 1), makeLine(2, 1)];
  const context = { lyricsUi: { activeLyricIndex: 0 }, playback: { currentTime: .95, isPlaying: true } };
  const sandbox = vm.createContext({ context, elements: { lyrics: { querySelectorAll: () => nodes } }, bool: key => key === 'showWordProgress', lastActiveIndex: -2, scrollToActive() {} });
  vm.runInContext(functions, sandbox);
  const update = () => vm.runInContext('updateLyricState()', sandbox);
  update();
  assert.equal(nodes[0].word.style.progress, '95%');
  context.lyricsUi.activeLyricIndex = 1;
  context.playback.currentTime = 1.1;
  update();
  assert.equal(nodes[0].word.style.progress, '100%');
  context.lyricsUi.activeLyricIndex = 2;
  context.playback.currentTime = 2.1;
  update();
  assert.equal(nodes[1].word.style.progress, '100%');
  context.lyricsUi.activeLyricIndex = 0;
  context.playback.currentTime = .5;
  update();
  assert.equal(nodes[0].word.style.progress, '50%');
  assert.equal(nodes[1].word.style.progress, '0%');
  assert.equal(nodes[2].word.style.progress, '0%');
});
