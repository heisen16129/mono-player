import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('.', import.meta.url));
await build({ absWorkingDir: root, entryPoints: ['backend/mono/protocol.test.ts'], outfile: '../../target/miot-tests/protocol.test.mjs', bundle: true, platform: 'node', format: 'esm' });
execFileSync(process.execPath, ['--test', 'plugin/miot/backend/mono/adapter.test.mjs', 'target/miot-tests/protocol.test.mjs'], { cwd: fileURLToPath(new URL('../../', import.meta.url)), stdio: 'inherit' });
