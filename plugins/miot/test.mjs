import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('.', import.meta.url));
await build({ absWorkingDir: root, entryPoints: ['mono/protocol.test.ts'], outfile: 'dist/protocol.test.mjs', bundle: true, platform: 'node', format: 'esm' });
execFileSync(process.execPath, ['--test', 'plugins/miot/mono/adapter.test.mjs', 'plugins/miot/dist/protocol.test.mjs'], { cwd: fileURLToPath(new URL('../../', import.meta.url)), stdio: 'inherit' });
