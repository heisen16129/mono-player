import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(pluginRoot, 'upstream', 'public');
const indexHtml = await readFile(path.join(publicRoot, 'index.html'), 'utf8');
const loaderSource = await readFile(path.join(publicRoot, 'js', 'index-loader.js'), 'utf8');
const modulePaths = [...loaderSource.matchAll(/^\s*'([^']+\.js)',?\s*$/gm)].map((match) => match[1]);

if (modulePaths.length < 90) {
  throw new Error(`Unexpected Mineradio module list: ${modulePaths.length}`);
}

const bodyMatch = indexHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
if (!bodyMatch) throw new Error('Mineradio index.html has no body.');

const bodyHtml = bodyMatch[1]
  .replace(/\s*<script\s+src=["']js\/index-loader\.js["']><\/script>\s*/i, '')
  .trim();
const reservedWords = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if',
  'import', 'in', 'instanceof', 'let', 'new', 'return', 'static', 'super', 'switch',
  'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
]);
const inlineHandlerNames = new Set();
function collectInlineHandlerNames(source) {
  for (const attribute of source.matchAll(/\son[a-z]+\s*=\s*(["'])(.*?)\1/gi)) {
    for (const call of attribute[2].matchAll(/(?<![.$\w])([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (!reservedWords.has(call[1])) inlineHandlerNames.add(call[1]);
    }
  }
}
collectInlineHandlerNames(bodyHtml);
const cssSource = await readFile(path.join(publicRoot, 'css', 'index.css'), 'utf8');
const workshopRoot = path.join(publicRoot, 'vendor', 'sonic-workshop');
const workshopBridgeHtml = await readFile(path.join(workshopRoot, 'mineradio-bridge.html'), 'utf8');
const workshopScript = await readFile(path.join(workshopRoot, 'assets', 'index-Z-j1MQ-r.js'), 'utf8');
const workshopCss = await readFile(path.join(workshopRoot, 'assets', 'index-Bhwp8mwk.css'), 'utf8');
const workshopSrcdoc = workshopBridgeHtml
  .replace(
    /<script\s+type="module"\s+crossorigin\s+src="assets\/index-Z-j1MQ-r\.js"><\/script>/i,
    () => `<script type="module">${workshopScript.replace(/<\/script/gi, '<\\/script')}</script>`,
  )
  .replace(
    /<link\s+rel="stylesheet"\s+crossorigin\s+href="assets\/index-Bhwp8mwk\.css">/i,
    () => `<style>${workshopCss.replace(/<\/style/gi, '<\\/style')}</style>`,
  );
const runtimeParts = [
  await readFile(path.join(publicRoot, 'vendor', 'three.r128.min.js'), 'utf8'),
  await readFile(path.join(publicRoot, 'vendor', 'music-tempo.min.js'), 'utf8'),
  await readFile(path.join(publicRoot, 'vendor', 'gsap.min.js'), 'utf8'),
  await readFile(path.join(publicRoot, 'js', 'preload-mode.js'), 'utf8'),
];
for (const modulePath of modulePaths) runtimeParts.push(await readFile(path.join(publicRoot, modulePath), 'utf8'));

const runtimeSource = runtimeParts.join('\n;\n').replace(
  'iframe.src = BRIDGE_SRC;',
  "if (global.__monoMineradioWorkshopSrcdoc) iframe.srcdoc = global.__monoMineradioWorkshopSrcdoc; else iframe.src = BRIDGE_SRC;",
);
if (!runtimeSource.includes('iframe.srcdoc = global.__monoMineradioWorkshopSrcdoc')) {
  throw new Error('Mineradio Sonic Workshop iframe hook was not generated.');
}
collectInlineHandlerNames(runtimeSource);
const runtimeResult = await transform(runtimeSource, {
  loader: 'js',
  target: 'es2020',
  minifyWhitespace: true,
  minifySyntax: true,
  minifyIdentifiers: false,
  legalComments: 'none',
  sourcefile: 'mineradio-2.1.0-original-runtime.js',
});
const cssResult = await transform(cssSource, {
  loader: 'css',
  minify: true,
  legalComments: 'none',
  sourcefile: 'mineradio-2.1.0-original.css',
});

const generated = [
  '// Generated from upstream/public by scripts/generate-upstream.mjs.',
  `export const UPSTREAM_BODY_HTML = ${JSON.stringify(bodyHtml)};`,
  `export const UPSTREAM_CSS = ${JSON.stringify(cssResult.code)};`,
  `export const UPSTREAM_INLINE_HANDLER_NAMES = ${JSON.stringify([...inlineHandlerNames].sort())};`,
  `export const UPSTREAM_RUNTIME = ${JSON.stringify(runtimeResult.code)};`,
  `export const UPSTREAM_WORKSHOP_SRCDOC = ${JSON.stringify(workshopSrcdoc)};`,
  `export const UPSTREAM_MODULE_COUNT = ${modulePaths.length};`,
  '',
].join('\n');
await writeFile(path.join(pluginRoot, 'src', 'generated', 'upstream.mjs'), generated, 'utf8');
console.log(`Generated Mineradio runtime from ${modulePaths.length} modules.`);
