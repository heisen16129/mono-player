import test from 'node:test';
import assert from 'node:assert/strict';
import { currentLines, cardLines } from '../src/lyrics.mjs';
test('seek backwards restores the earlier lyric', () => {
  const lines = [{ time: 0, text: 'A' }, { time: 10, text: 'B' }];
  assert.equal(currentLines(lines, 12).current, 'B');
  assert.equal(currentLines(lines, 2).current, 'A');
});
test('card paragraphs retain translations without treating them as separate lyric rows', () => {
  const rows = cardLines([{ time: 0, text: 'Hello' }, { time: 0, text: '你好' }, { time: 3, text: 'World' }, { time: 6, text: 'Again' }], 1);
  assert.deepEqual(rows[0], { text: 'Hello', secondary: '你好', active: true });
  assert.equal(rows.length, 3);
});
test('live paragraph window stays full at the end and follows backward seeks', () => {
  const lines = Array.from({ length: 8 }, (_, i) => ({ time: i * 5, text: String(i) }));
  assert.deepEqual(cardLines(lines, 38).map(row => row.text), ['4', '5', '6', '7']);
  assert.deepEqual(cardLines(lines, 2).map(row => row.text), ['0', '1', '2', '3']);
  assert.ok(cardLines(lines, -1).every(row => !row.active));
});
test('translation at identical timestamp stays with original', () => {
  assert.deepEqual(currentLines([{ time: 0, text: 'Hello' }, { time: 0, text: '你好' }, { time: 5, text: 'Next' }], 2), { current: 'Hello · 你好', next: 'Next' });
});
test('untimed and missing lyrics do not invent timing', () => {
  assert.equal(currentLines([{ time: null, text: 'Plain' }], 40).current, 'Plain');
  assert.deepEqual(currentLines([], 40), { current: '', next: '' });
});
