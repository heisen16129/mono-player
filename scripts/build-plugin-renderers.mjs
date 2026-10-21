import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const renderers = ['apple-music-lyrics', 'betterlyrics', 'desktop-lyrics-example', 'fanlyrics', 'mineradio-original-lyrics', 'playback-card'];
for (const name of renderers) {
  const dir = join(root, 'plugin', name);
  if (['betterlyrics', 'fanlyrics', 'playback-card'].includes(name)) {
    const result = spawnSync(process.execPath, [join(dir, 'ui', 'build.mjs')], { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`${name}: renderer build failed`);
  }
  if (name === 'mineradio-original-lyrics') {
    const result = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(dir, 'ui', 'build.ps1')], { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`${name}: renderer build failed`);
  }
  const source = join(dir, 'ui', 'renderer.mjs');
  const check = spawnSync(process.execPath, ['--check', source], { stdio: 'inherit' });
  if (check.status !== 0) throw new Error(`${name}: invalid renderer module`);
  mkdirSync(join(dir, 'ui'), { recursive: true });
  await build({
    stdin: { contents: "import renderer from './renderer.mjs'; import { mountRenderer } from './packages/plugin-sdk/src/renderer'; mountRenderer(renderer, document.body).catch(error => { document.body.textContent = String(error); });", resolveDir: root, sourcefile: 'plugin-page.ts', loader: 'ts' },
    external: ['./renderer.mjs'], bundle: true, format: 'esm', target: 'es2020', outfile: join(dir, 'ui', 'page.mjs'),
  });
  writeFileSync(join(dir, 'ui', 'index.html'), '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}</style><script type="module" src="./page.mjs"></script></html>\n');
  console.log(`Built ${name}: ui/renderer.mjs`);
}
