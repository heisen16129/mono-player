import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const native = readFileSync('src-tauri/src/plugins/api/mod.rs','utf8').split('pub(crate) const METHODS:')[1].split('];')[0];
const methods = [...native.matchAll(/\("([^" ]+)"\s*,/g)].map(match => match[1]);
const sdk = readdirSync('packages/plugin-sdk/src').filter(file=>file.endsWith('.ts')).map(file=>readFileSync(`packages/plugin-sdk/src/${file}`,'utf8')).join('\n');

test('SDK and native public method registry have the same contract',()=>{
  assert.equal(new Set(methods).size,methods.length);
  for (const method of methods) assert.ok(sdk.includes(`'${method}'`),`SDK missing ${method}`);
  const exposed = [...sdk.matchAll(/['"]((?:host|events|audio|tasks|library|lyrics|ui|config|storage|favorites|playlists|sources|history|queue|service|files|speaker|window|artwork|media|separation|player)\.[A-Za-z]+)['"]/g)].map(match=>match[1]);
  assert.deepEqual([...new Set(exposed)].sort(),[...methods].sort());
});

test('all 24 plugins declare v1 and only registered permissions; launchers are opt in',()=>{
  const dirs = readdirSync('plugin',{withFileTypes:true}).filter(entry=>entry.isDirectory());
  const manifests = dirs.flatMap(entry=>{try{return [JSON.parse(readFileSync(`plugin/${entry.name}/plugin.json`,'utf8'))];}catch(error){if(error.code==='ENOENT')return [];throw error;}});
  assert.equal(manifests.length,24);
  assert.equal(new Set(manifests.map(m=>m.id)).size,24);
  const permissions = new Set(['network',...[...native.matchAll(/Some\("([^" ]+)"\)/g)].map(match=>match[1])]);
  for (const manifest of manifests) {
    assert.equal(manifest.apiVersion,1,manifest.id);
    assert.equal(manifest.schemaVersion,1,manifest.id);
    for (const permission of manifest.permissions) assert.ok(permissions.has(permission),`${manifest.id}: ${permission}`);
  }
  const speaker=manifests.find(m=>m.id==='mono-wasm-miot');
  const separation=manifests.find(m=>m.id==='mono-wasm-stem-separation');
  assert.equal(speaker.contributions.sidebar?.length??0,0);
  assert.ok(speaker.contributions.playbackBar.length>0);
  assert.equal(speaker.entry.wasm, undefined);
  assert.equal(speaker.entry.service, 'dist/service.mjs');
  assert.equal(existsSync('plugin/miot/dist/plugin.wasm'), false);
  assert.equal(separation.contributions.playbackBar?.length??0,0);
  assert.ok(separation.contributions.sidebar.length>0);
});


test('plugin source layout separates backend source and compiled WASM output', () => {
  for (const directory of readdirSync('plugin', { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    const base = `plugin/${directory.name}`;
    if (!existsSync(`${base}/plugin.json`)) continue;
    const manifest = JSON.parse(readFileSync(`${base}/plugin.json`, 'utf8'));
    assert.equal(existsSync(`${base}/ui/manifest.json`), false, `${base}: only plugin.json declares the plugin`);
    assert.equal(existsSync(`${base}/src`), false, `${base}: source belongs in backend/ or ui/`);
    assert.equal(existsSync(`${base}/Cargo.toml`), false, `${base}: Cargo.toml belongs in backend/`);
    if (manifest.entry.wasm) {
      assert.equal(manifest.entry.wasm, 'dist/plugin.wasm');
      assert.ok(existsSync(`${base}/backend/Cargo.toml`));
      assert.ok(existsSync(`${base}/dist/plugin.wasm`));
      assert.deepEqual(readdirSync(`${base}/dist`).filter(file => file.endsWith('.wasm')), ['plugin.wasm']);
    }
  }
});
