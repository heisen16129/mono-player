import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import '../plugin/stem-separation/backend/jobs.test.mjs';
const manifest = JSON.parse(readFileSync('plugin/stem-separation/plugin.json', 'utf8'));
test('separation ships its own backend without host business API or metadata WASM', () => {
  assert.equal(manifest.entry.service, 'dist/service.mjs');
  assert.equal(manifest.entry.wasm, undefined);
  assert.equal(existsSync('plugin/stem-separation/dist/plugin.wasm'), false);
  assert.equal(existsSync('src-tauri/src/stem_separation/worker.py'), false);
  assert.ok(existsSync('plugin/stem-separation/backend/worker.py'));
  const methods = readFileSync('src-tauri/src/plugins/api/mod.rs', 'utf8');
  assert.equal(methods.includes('"separation.'), false);
  assert.equal(methods.includes('"tasks.'), false);
});
