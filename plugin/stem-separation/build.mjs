import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
await import('../../packages/plugin-sdk/build.mjs');
// Keep source-relative Python resource paths valid in the emitted entry.
await build({ absWorkingDir: root, entryPoints: ['plugin/stem-separation/backend/service.mjs'], outfile: 'plugin/stem-separation/dist/service.mjs',
  bundle: true, platform: 'node', target: 'node20', format: 'esm' });
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'plugin/stem-separation/vite.config.mjs'], { cwd: root, stdio: 'inherit' });
