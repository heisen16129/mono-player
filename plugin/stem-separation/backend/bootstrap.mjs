import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { run } from './process.mjs';

export async function prepareUv(root, signal) {
  const arch = { x64: 'x86_64', arm64: 'aarch64' }[process.arch];
  const platform = { win32: 'pc-windows-msvc', darwin: 'apple-darwin', linux: 'unknown-linux-musl' }[process.platform];
  if (!arch || !platform) throw new Error('当前系统暂不支持自动准备环境，请配置 Python 路径');
  const asset = `uv-${arch}-${platform}`, extension = process.platform === 'win32' ? 'zip' : 'tar.gz';
  const tools = join(root, 'tools'); mkdirSync(tools, { recursive: true });
  const executable = process.platform === 'win32' ? join(tools, 'uv.exe') : join(tools, asset, 'uv');
  if (existsSync(executable)) return executable;
  const base = `https://github.com/astral-sh/uv/releases/download/0.10.7/${asset}.${extension}`;
  const response = async url => {
    const result = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]) });
    if (!result.ok) throw new Error(`环境组件下载失败：${result.status}`);
    return result;
  };
  const expected = (await (await response(`${base}.sha256`)).text()).trim().split(/\s+/)[0];
  if (!/^[0-9a-f]{64}$/i.test(expected)) throw new Error('组件校验信息无效');
  const chunks = []; let size = 0;
  for await (const chunk of (await response(base)).body) {
    size += chunk.length; if (size > 64 * 1024 * 1024) throw new Error('组件超出大小限制'); chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (createHash('sha256').update(bytes).digest('hex') !== expected.toLowerCase()) throw new Error('组件文件校验失败');
  const archive = join(tools, `uv.${extension}`); writeFileSync(archive, bytes);
  await run('tar', ['-xf', archive, '-C', tools], { signal, timeout: 60_000 });
  if (!existsSync(executable)) throw new Error('环境组件解压失败');
  return executable;
}
