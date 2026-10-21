import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
const transcoders = new Set();
export function stopMedia() { for (const child of transcoders) child.kill(); transcoders.clear(); }

export function byteRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) throw new Error('range');
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) throw new Error('range');
  return { start, end };
}
const contentTypes = { '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.otf': 'font/otf' };
export async function serveFile(path, req, res) {
  const info = await stat(path);
  if (!info.isFile()) throw new Error('文件不存在');
  let range;
  try { range = byteRange(req.headers.range, info.size); }
  catch { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return; }
  res.writeHead(range ? 206 : 200, { 'Content-Type': contentTypes[extname(path).toLowerCase()] || 'application/octet-stream',
    'Accept-Ranges': 'bytes', 'Content-Length': range ? range.end - range.start + 1 : info.size,
    ...(range ? { 'Content-Range': `bytes ${range.start}-${range.end}/${info.size}` } : {}) });
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = createReadStream(path, range || {});
  res.on('close', () => stream.destroy()); stream.on('error', () => res.destroy()); stream.pipe(res);
}
export async function serveMedia(source, query, req, res, ffmpeg) {
  const image = /^data:(image\/(?:png|jpeg|webp|bmp|gif|avif));base64,([A-Za-z0-9+/=]+)$/.exec(source);
  if (image) {
    if (image[2].length > 45 * 1024 * 1024) throw new Error('封面图片过大');
    const data = Buffer.from(image[2], 'base64');
    res.writeHead(200, { 'Content-Type': image[1], 'Content-Length': data.length });
    res.end(req.method === 'HEAD' ? undefined : data);
    return;
  }
  // Tauri asset URLs refer to local files; they are not network servers.
  if (/^(?:https?:\/\/asset\.localhost\/|asset:\/\/localhost\/)/i.test(source)) {
    source = decodeURIComponent(new URL(source).pathname.slice(1));
  }
  if (source.startsWith('file:')) source = fileURLToPath(source);
  const seek = Number(query.get('seek') || 0), speed = Number(query.get('speed') || 1);
  if (!Number.isFinite(seek) || seek < 0 || seek > 86400 || !Number.isFinite(speed) || speed < 0.5 || speed > 2) throw new Error('无效的播放位置或速度');
  const normalize = query.get('normalize') === '1';
  if (query.get('format') === 'mp3' || query.get('radio_transcode') === 'mp3' || seek || speed !== 1 || normalize) {
    const args = ['-nostdin', '-loglevel', 'error', '-protocol_whitelist', 'file,http,https,tcp,tls,crypto', ...(seek ? ['-ss', String(seek)] : []), '-i', source, '-vn'];
    const filters = [...(speed !== 1 ? [`atempo=${speed}`] : []), ...(normalize ? ['loudnorm=I=-16:TP=-1.5:LRA=11'] : [])];
    if (filters.length) args.push('-af', filters.join(','));
    args.push('-f', 'mp3', '-codec:a', 'libmp3lame', '-b:a', '192k', 'pipe:1');
    const child = spawn(ffmpeg, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    transcoders.add(child); child.on('close', () => transcoders.delete(child));
    child.stderr.resume();
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', () => reject(new Error('请安装 FFmpeg 后重试转码播放'))); });
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'none' });
    res.on('close', () => child.kill()); child.stdout.on('error', () => res.destroy());
    child.on('exit', code => { if (code) res.destroy(); });
    if (req.method === 'HEAD') { child.kill(); res.end(); } else child.stdout.pipe(res);
    return;
  }
  if (!/^https?:\/\//i.test(source)) { await serveFile(source, req, res); return; }
  const abort = new AbortController(); res.on('close', () => abort.abort());
  const upstream = await fetch(source, { method: req.method, signal: abort.signal,
    headers: req.headers.range ? { Range: req.headers.range } : {} });
  const headers = {};
  for (const key of ['content-type', 'content-length', 'content-range', 'accept-ranges']) if (upstream.headers.has(key)) headers[key] = upstream.headers.get(key);
  res.writeHead(upstream.status, headers);
  if (!upstream.body || req.method === 'HEAD') res.end();
  else Readable.fromWeb(upstream.body).on('error', () => res.destroy()).pipe(res);
}
