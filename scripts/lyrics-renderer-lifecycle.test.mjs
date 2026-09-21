import assert from 'node:assert/strict';
import { build } from 'esbuild';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('renderer discovery synchronizes enable, update, disable and removal', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const result = await build({
    stdin: { contents: `export * from './src/lyrics-renderers/registry'; export * from './src/lyrics-renderers/external';`, resolveDir: root },
    bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'mock-host', setup(builder) {
      builder.onLoad({ filter: /services[\\/]plugins\.ts$/ }, () => ({ contents: 'export async function listInstalledPluginManifests() { return globalThis.__rendererManifests; }', loader: 'js' }));
      builder.onLoad({ filter: /\.vue$/ }, () => ({ contents: 'export default {}', loader: 'js' }));
    } }],
  });
  const registry = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  registry.registerLyricsRenderer({ id: 'classic', name: 'Classic', component: {} });
  const plugin = { id: 'test.page', name: 'Test page', version: '1', entry: 'page.mjs', enabled: true, runtime: 'module', kind: 'lyrics-renderer', capabilities: ['lyrics-renderer'] };
  try {
    globalThis.__rendererManifests = [plugin, { ...plugin, id: 'music', runtime: 'wasm', kind: 'music' }];
    await registry.loadExternalLyricsRenderers();
    const first = registry.getLyricsRenderer(plugin.id);
    assert.ok(first);
    assert.equal(registry.getLyricsRenderer('music'), null);
    await registry.loadExternalLyricsRenderers();
    assert.equal(registry.getLyricsRenderer(plugin.id), first);
    globalThis.__rendererManifests = [{ ...plugin, version: '2', name: 'Updated' }];
    await registry.loadExternalLyricsRenderers();
    assert.equal(registry.getLyricsRenderer(plugin.id).name, 'Updated');
    assert.notEqual(registry.getLyricsRenderer(plugin.id).component, first.component);
    globalThis.__rendererManifests = [{ ...plugin, enabled: false }];
    await registry.loadExternalLyricsRenderers();
    assert.equal(registry.getLyricsRenderer(plugin.id), null);
    globalThis.__rendererManifests = [plugin];
    await registry.loadExternalLyricsRenderers();
    assert.ok(registry.getLyricsRenderer(plugin.id));
    globalThis.__rendererManifests = [];
    await registry.loadExternalLyricsRenderers();
    assert.equal(registry.getLyricsRenderer(plugin.id), null);
    assert.ok(registry.getLyricsRenderer('classic'));
    globalThis.__rendererManifests = [{ ...plugin, id: 'classic' }];
    await registry.loadExternalLyricsRenderers();
    assert.equal(registry.getLyricsRenderer('classic').name, 'Classic');
  } finally { delete globalThis.__rendererManifests; }
});
