import './build.mjs';
import { copyFileSync, existsSync, readdirSync } from 'node:fs';
import { delimiter, join } from 'node:path';

const win = process.platform === 'win32';
copyFileSync(process.execPath, `dist/${win ? 'node.exe' : 'node'}`);
const filename = win ? 'ffmpeg.exe' : 'ffmpeg';
let binary = (process.env.PATH || '').split(delimiter).map(p => join(p, filename)).find(existsSync);
if (!binary && win) {
  const find = (path, depth) => {
    if (!existsSync(path) || depth < 0) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === filename) return file;
      if (entry.isDirectory()) { const value = find(file, depth - 1); if (value) return value; }
    }
  };
  for (const path of [join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages'), join(process.env.ProgramFiles || '', 'WinGet/Packages')]) {
    if (!existsSync(path)) continue;
    for (const entry of readdirSync(path)) if (entry.startsWith('Gyan.FFmpeg_')) binary ||= find(join(path, entry), 3);
  }
}
if (!binary) throw Error('打包音箱组件需要 FFmpeg，请先安装 FFmpeg 并将其加入 PATH。');
copyFileSync(binary, `dist/${filename}`);
console.log('音箱运行时与 FFmpeg 已打包，无需用户另行配置。');
