import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
await build({ absWorkingDir: fileURLToPath(new URL('.', import.meta.url)), entryPoints: ['src/client.ts', 'src/connect.ts'], outdir: 'dist', outExtension: { '.js': '.mjs' }, bundle: true, format: 'esm', target: 'es2020' });
