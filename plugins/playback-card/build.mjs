import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
await build({
  absWorkingDir: fileURLToPath(new URL('.', import.meta.url)),
  entryPoints: ['src/renderer.mjs'], outfile: 'renderer.mjs',
  bundle: true, format: 'esm', target: 'es2020', loader: { '.css': 'text' },
  legalComments: 'inline', banner: { js: '/*! Mono Playback Card for Mono — GPL-3.0-only. See LICENSE and NOTICE.md. */' },
});
console.log('Built Mono Playback Card: plugins/playback-card/renderer.mjs');
