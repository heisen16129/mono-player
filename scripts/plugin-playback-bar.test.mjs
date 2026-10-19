import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { transform } from 'esbuild';

const source = readFileSync('src/components/plugins/pluginLaunchers.ts', 'utf8');
const { code } = await transform(source.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', ''), { loader: 'ts' });
const context = vm.createContext({ AudioLines: 'audio-icon', Speaker: 'speaker-icon', MiotLauncher: 'miot', StemSeparationLauncher: 'stems' });
vm.runInContext(code, context);
const resolve = vm.runInContext('getPlaybackBarLaunchers', context);

test('window capability alone does not request a playback bar icon', () => {
  for (const capability of ['stem-separation', 'speaker-control']) {
    assert.equal(resolve({ capabilities: [capability] }).length, 0);
  }
});

test('plugin explicitly requests its action and icon', () => {
  const entries = resolve({ capabilities: ['speaker-control'], playbackBar: { action: 'speaker-control', icon: 'speaker' } });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].component, 'miot');
  assert.equal(entries[0].icon, 'speaker-icon');
});

test('unsupported or undeclared requests do not get an entry', () => {
  for (const request of [null, {}, { action: 'speaker-control', icon: 'unknown' }, { action: 'search', icon: 'speaker' }, { action: 'stem-separation', icon: 'speaker' }]) {
    assert.equal(resolve({ capabilities: ['speaker-control'], playbackBar: request }).length, 0);
  }
});
