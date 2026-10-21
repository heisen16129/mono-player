import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const init = process.argv.includes('--init-manifests');
const requested = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const directories = readdirSync(join(root, 'plugin'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
for (const name of directories) {
  if (requested.length && !requested.includes(name)) continue;
  const dir = join(root, 'plugin', name);
  const manifestPath = join(dir, 'plugin.json');
  if (!existsSync(manifestPath) || !JSON.parse(readFileSync(manifestPath, 'utf8')).entry.wasm) continue;
  const crate = join(dir, 'backend');
  if (!existsSync(join(crate, 'Cargo.toml'))) continue;
  const result = spawnSync('cargo', ['build', '--offline', '--release', '--target', 'wasm32-unknown-unknown', '--manifest-path', join(crate, 'Cargo.toml')], {
    cwd: root, stdio: 'inherit', env: { ...process.env, CARGO_TARGET_DIR: join(root, 'target', 'plugin-v1') },
  });
  if (result.status !== 0) throw new Error(`Build failed: ${name}`);
  const toml = readFileSync(join(crate, 'Cargo.toml'), 'utf8');
  const crateName = toml.match(/\[package\][\s\S]*?name\s*=\s*"([^"]+)"/)[1].replaceAll('-', '_');
  const wasm = join(root, 'target', 'plugin-v1', 'wasm32-unknown-unknown', 'release', `${crateName}.wasm`);
  const { instance } = await WebAssembly.instantiate(readFileSync(wasm));
  const e = instance.exports;
  const input = new TextEncoder().encode(JSON.stringify({ action: 'metadata' }));
  const ptr = e.mono_alloc(input.length);
  new Uint8Array(e.memory.buffer, ptr, input.length).set(input);
  const out = e.mono_invoke(ptr, input.length), len = e.mono_last_len();
  const response = JSON.parse(new TextDecoder().decode(new Uint8Array(e.memory.buffer, out, len)));
  e.mono_dealloc(ptr, input.length); e.mono_dealloc(out, len);
  if (response.code !== 1) throw new Error(`Metadata failed: ${name}`);
  const metadata = response.data;
  const path = join(dir, 'plugin.json');
  if (init && !existsSync(path)) {
    const manifest = { schemaVersion: 1, apiVersion: 1, minHostVersion: '0.1.0',
      ...Object.fromEntries(['id','name','version','kind','author','description','capabilities','permissions','configSchema'].filter(k => metadata[k] !== undefined).map(k => [k, metadata[k]])),
      entry: { wasm: 'dist/plugin.wasm' }, contributions: {},
    };
    if (name === 'miot' || name === 'stem-separation') {
      const title = metadata.name, id = name === 'miot' ? 'speaker' : 'separation';
      manifest.contributions.pages = [{ id, title, entry: 'ui/index.html' }];
      manifest.contributions[name === 'miot' ? 'playbackBar' : 'sidebar'] = [{ id: `open-${id}`, title, icon: name === 'miot' ? 'speaker' : 'audio-lines', pageId: id }];
    }
    writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
  }
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  for (const key of ['id', 'version', 'kind']) if (manifest[key] !== metadata[key]) throw new Error(`${name}: metadata ${key} differs from plugin.json`);
  if (!init && (metadata.apiVersion !== 1 || metadata.schemaVersion !== 1)) throw new Error(`${name}: backend metadata is not v1`);
  mkdirSync(join(dir, 'dist'), { recursive: true });
  copyFileSync(wasm, join(dir, 'dist', 'plugin.wasm'));
  console.log(`Built ${name}: ${manifest.id}`);
}
