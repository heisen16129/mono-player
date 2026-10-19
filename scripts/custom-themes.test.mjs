import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const source = readFileSync('src/stores/player/theme.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export function', 'function');
const { code } = await transform(source, { loader: 'ts' });
const tick = () => new Promise(setImmediate);

test('theme mutations wait for settings, apply backend snapshots and recover after failure', async () => {
  const pending = [], errors = [], calls = [];
  const settings = { value: { theme: 'blueWhite', locale: 'en-US' } };
  const themes = { value: [] };
  const defer = (kind, value) => {
    calls.push(kind);
    return new Promise((resolve, reject) => pending.push({ value, resolve, reject }));
  };
  const context = vm.createContext({
    saveSettings: value => defer('settings', value),
    saveCustomTheme: value => defer('upsert', value),
    deleteCustomTheme: value => defer('remove', value),
    selectTheme: value => defer('select', value),
    document: { documentElement: { dataset: {}, style: { setProperty() {}, removeProperty() {} } } },
    isCustomTheme: value => value.startsWith('custom:'), resolveLocale: value => value,
    requestAnimationFrame() {}, themeAssetSrc: value => value,
  });
  vm.runInContext(code, context);
  const ui = context.createPlayerThemeController({ settings, customThemes: themes, onSettingsError: error => errors.push(error) });
  ui.persistSettings(false);
  const theme = { id: 'custom:a', name: 'A', author: 'Author', variables: {} };
  const adding = ui.addCustomTheme(theme);
  await tick();
  assert.deepEqual(calls, ['settings']);
  assert.deepEqual(themes.value, []);
  pending[0].resolve({ ...settings.value });
  await tick();
  assert.deepEqual(calls, ['settings', 'upsert']);
  pending[1].resolve({ themes: [theme], activeTheme: theme.id });
  await adding;
  assert.equal(settings.value.theme, theme.id);
  const removing = ui.removeCustomTheme(theme.id);
  const failure = assert.rejects(removing, /disk full/);
  await tick();
  pending[2].reject(new Error('disk full'));
  await failure;
  assert.equal(settings.value.theme, theme.id);
  assert.equal(themes.value.length, 1);
  const retry = ui.removeCustomTheme(theme.id);
  await tick();
  pending[3].resolve({ themes: [], activeTheme: 'blueWhite' });
  await retry;
  assert.equal(settings.value.theme, 'blueWhite');
  assert.equal(themes.value.length, 0);
  assert.equal(errors.length, 1);
});
