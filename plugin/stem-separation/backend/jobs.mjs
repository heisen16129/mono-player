import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './process.mjs';

const worker = fileURLToPath(new URL('../backend/worker.py', import.meta.url));
const extensions = new Set(['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.opus', '.wma', '.mp4']);
export function inside(root, path) { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\'); }
export function collect(source, output) {
  const files = [];
  function visit(path) {
    const entry = statSync(path);
    if (entry.isFile()) { if (extensions.has(extname(path).toLowerCase())) files.push(path); return; }
    for (const item of readdirSync(path, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const next = join(path, item.name);
      if (item.isSymbolicLink() || inside(output, next)) continue;
      if (item.isDirectory() || item.isFile()) visit(next);
    }
  }
  visit(realpathSync(source)); return files;
}
export function cacheKey(source) {
  const path = realpathSync(source), stat = statSync(path, { bigint: true });
  return createHash('sha256').update(`htdemucs_6s:${path}:${stat.size}:${stat.mtimeNs}`).digest('hex');
}
export class Jobs {
  constructor(root, environment, config, runner = run) {
    this.output = join(root, 'output'); this.environment = environment; this.config = config; this.runner = runner;
    mkdirSync(this.output, { recursive: true }); this.batch = null; this.task = null;
  }
  busy() { return this.batch && ['scanning', 'running', 'cancelling'].includes(this.batch.stage); }
  cached(source) {
    const output = join(this.output, cacheKey(source));
    try {
      const name = readFileSync(join(output, 'ready.txt'), 'utf8').trim();
      const directory = realpathSync(join(output, name));
      if (!inside(output, directory)) return null;
      const vocalsPath = join(directory, 'vocals.wav'), accompanimentPath = join(directory, 'accompaniment.wav');
      return existsSync(vocalsPath) && existsSync(accompanimentPath) ? { vocalsPath, accompanimentPath } : null;
    } catch { return null; }
  }
  start(source) {
    if (this.busy() || this.environment.busy()) throw new Error('已有任务正在运行，请稍后重试');
    if (this.environment.status.stage !== 'ready') throw new Error('请先准备分离环境');
    const files = collect(source, this.output);
    if (!files.length) throw new Error('没有支持的音频文件');
    this.abort = new AbortController(); this.started = Date.now(); this.task = null;
    this.task = { id: randomUUID(), pluginId: 'mono-wasm-stem-separation', stage: 'loading', progress: null, device: null,
      message: null, outputDir: this.output, vocalsPath: null, accompanimentPath: null };
    this.batch = { id: randomUUID(), stage: 'running', elapsedMs: 0, source: basename(source), outputDir: this.output,
      message: null, current: null, items: files.map((path, i) => ({ id: `item:${i}`, source: basename(path), stage: 'pending', message: null, vocalsPath: null, accompanimentPath: null })) };
    this.pending = this.execute(files); return this.batch;
  }
  cancel() { if (this.busy()) { this.batch.stage = 'cancelling'; this.abort.abort(); } }
  snapshot() { if (this.busy()) this.batch.elapsedMs = Date.now() - this.started; return this.batch; }
  async execute(files) {
    try {
      const config = await this.config();
      const device = config.device || 'auto';
      if (!['auto', 'cpu', 'cuda', 'mps'].includes(device)) throw new Error('不支持的计算设备');
      for (const [i, source] of files.entries()) {
        if (this.abort.signal.aborted) break;
        const item = this.batch.items[i], cached = this.cached(source);
        if (cached) { Object.assign(item, cached, { stage: 'done' }); if (i === 0) Object.assign(this.task, cached, { stage: 'done', progress: 100 }); continue; }
        const parent = join(this.output, cacheKey(source)), output = join(parent, randomUUID());
        mkdirSync(output, { recursive: true });
        const task = this.task = { id: i === 0 ? this.task.id : randomUUID(), pluginId: 'mono-wasm-stem-separation', stage: 'loading', progress: null,
          device: null, message: null, outputDir: output, vocalsPath: null, accompanimentPath: null };
        this.batch.current = task; item.stage = 'running';
        try {
          const request = { source, outputDir: output, cacheDir: join(this.environment.root, 'models'), model: 'htdemucs_6s', device };
          await this.runner(this.environment.status.pythonPath, ['-I', '-u', worker, JSON.stringify(request)], {
            signal: this.abort.signal, timeout: 86_400_000,
            onLine: line => { const event = JSON.parse(line); Object.assign(task, event, event.stage === 'done' ? { stage: 'exporting' } : {}); if (event.stage === 'error') throw new Error(event.message); },
          });
          if (this.abort.signal.aborted) throw new Error('已取消');
          const vocalsPath = join(output, 'vocals.wav'), accompanimentPath = join(output, 'accompaniment.wav');
          if (!existsSync(vocalsPath) || !existsSync(accompanimentPath)) throw new Error('分离输出不完整');
          writeFileSync(join(parent, 'ready.txt'), basename(output));
          Object.assign(task, { stage: 'done', progress: 100, vocalsPath, accompanimentPath });
          Object.assign(item, { stage: 'done', vocalsPath, accompanimentPath });
        } catch (error) {
          rmSync(output, { recursive: true, force: true });
          Object.assign(task, { stage: this.abort.signal.aborted ? 'cancelled' : 'error', message: error.message });
          Object.assign(item, { stage: task.stage, message: error.message });
        }
      }
      this.batch.stage = this.abort.signal.aborted ? 'cancelled' : this.batch.items.some(item => item.stage === 'error') ? 'error' : 'done';
    } catch (error) { this.batch.stage = this.abort.signal.aborted ? 'cancelled' : 'error'; this.batch.message = error.message; }
    finally {
      if (this.task && !['done', 'error', 'cancelled'].includes(this.task.stage)) Object.assign(this.task, { stage: this.batch.stage, message: this.batch.message });
      this.batch.elapsedMs = Date.now() - this.started;
    }
  }
}
