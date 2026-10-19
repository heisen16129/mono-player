import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const tick = () => new Promise(setImmediate);
test('settings saves are ordered, apply validated response, and recover after failure', async () => {
  const pending = [], errors = [];
  const settings = { value: { lyricFontSize: 99 } };
  const context = vm.createContext({ saveSettings: value => new Promise((resolve, reject) => pending.push({ value, resolve, reject })) });
  const source = readFileSync('src/stores/player/theme.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export function', 'function');
  const { code } = await transform(source, { loader: 'ts' });
  vm.runInContext(code, context);
  const controller = context.createPlayerThemeController({ settings, customThemes: { value: [] }, onSettingsError: e => errors.push(e) });
  controller.persistSettings(false); await tick();
  settings.value.lyricFontSize = 25;
  controller.persistSettings(false); await tick();
  assert.equal(pending.length, 1);
  pending[0].resolve({ lyricFontSize: 34 }); await tick();
  assert.equal(settings.value.lyricFontSize, 25);
  assert.equal(pending.length, 2);
  pending[1].reject(new Error('disk full')); await tick();
  assert.equal(errors.length, 1);
  settings.value.lyricFontSize = 9;
  controller.persistSettings(false); await tick();
  pending[2].resolve({ lyricFontSize: 14 }); await tick();
  assert.equal(settings.value.lyricFontSize, 14);
});

test('backend defaults match frontend startup defaults', async () => {
  const source = readFileSync('src/stores/player/constants.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replaceAll('export const', 'const');
  const { code } = await transform(source, { loader: 'ts' });
  const context = vm.createContext({});
  vm.runInContext(code + '\nglobalThis.defaults = fallbackSettings;', context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.defaults)), JSON.parse(readFileSync('src-tauri/src/settings/defaults.json', 'utf8')));
});
