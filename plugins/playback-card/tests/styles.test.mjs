import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardStyles, cardStyle, createStyleSelection } from '../src/cardStyles.mjs';

test('every selectable style has a layout and a matching manifest option', () => {
  const css = readFileSync(new URL('../src/themes.css', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.equal(new Set(cardStyles.map(style => style.id)).size, 14);
  assert.deepEqual(manifest.configSchema.fields[0].options.map(option => option.value), cardStyles.map(style => style.id));
  for (const style of cardStyles.slice(1)) assert.ok(css.includes(`[data-style=${style.id}]`), style.id);
  assert.equal(cardStyle('unknown').id, 'minimal');
});
test('stale playback config cannot undo a style change, including rapid changes', () => {
  const state = createStyleSelection();
  state.choose('cinematic');
  assert.equal(state.receive('minimal'), 'cinematic');
  state.choose('ancient');
  assert.equal(state.receive('cinematic'), 'ancient');
  assert.equal(state.receive('ancient'), 'ancient');
  assert.equal(state.receive('ticket'), 'ticket');
});
