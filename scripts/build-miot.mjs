import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../plugins/miot/', import.meta.url));
const npm = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
for (const [directory, dependency] of [[root, '@songloft/plugin-sdk'], [join(root, 'frontend'), 'vite']]) {
  if (!existsSync(join(directory, 'node_modules', dependency))) {
    if (!existsSync(npm)) throw Error('请通过 npm run miot:build 构建音箱插件');
    execFileSync(process.execPath, [npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: directory, stdio: 'inherit' });
  }
}
await import(new URL(process.argv.includes('--bundle') ? '../plugins/miot/bundle.mjs' : '../plugins/miot/build.mjs', import.meta.url));
