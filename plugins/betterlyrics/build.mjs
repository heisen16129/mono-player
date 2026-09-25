import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('.', import.meta.url));
await build({
  absWorkingDir: directory, entryPoints: ['src/renderer.mjs'], outfile: 'renderer.mjs',
  bundle: true, format: 'esm', target: 'es2020', loader: { '.css': 'text' },
  legalComments: 'inline', banner: { js: '/*! BetterLyrics for Mono — GPL-3.0-only. See LICENSE and NOTICE.md. */' },
});
console.log('Built BetterLyrics: plugins/betterlyrics/renderer.mjs');
