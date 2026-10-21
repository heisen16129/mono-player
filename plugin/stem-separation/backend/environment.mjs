import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './process.mjs';
import { prepareUv } from './bootstrap.mjs';

const backend = fileURLToPath(new URL('../backend/', import.meta.url));
export class Environment {
  constructor(root, config) {
    this.root = root; this.config = config;
    this.status = { stage: 'idle', message: '请检查运行环境', pythonPath: null };
  }
  busy() { return ['checking', 'installing', 'cancelling'].includes(this.status.stage); }
  begin(install = false) {
    if (this.busy()) return this.status;
    this.abort = new AbortController();
    this.status = { stage: install ? 'installing' : 'checking', message: '正在检查分离环境…', pythonPath: null };
    this.pending = this.prepare(install).catch(error => {
      this.status = { stage: this.abort.signal.aborted ? 'cancelled' : 'error', message: error.message, pythonPath: null };
    });
    return this.status;
  }
  cancel() { if (this.busy()) { this.status.stage = 'cancelling'; this.abort.abort(); } }
  async prepare(install) {
    const config = await this.config();
    const python = join(this.root, 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    const candidates = [config.pythonPath, python,
      process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'MonoDemucs/Scripts/python.exe')].filter(p => p && existsSync(p));
    const options = { signal: this.abort.signal, env: { TORCH_HOME: join(this.root, 'models') } };
    for (const path of [...new Set(candidates)]) {
      try {
        await run(path, ['-I', '-u', join(backend, 'check_environment.py')], { ...options, timeout: 90_000 });
        this.status = { stage: 'ready', message: '分离环境已就绪', pythonPath: path }; return;
      } catch (error) { if (this.abort.signal.aborted) throw error; }
    }
    if (!install) { this.status = { stage: 'missing', message: '首次使用需要准备分离组件', pythonPath: null }; return; }
    mkdirSync(this.root, { recursive: true });
    this.status.message = '正在准备独立 Python 环境…';
    const uv = await prepareUv(this.root, this.abort.signal);
    options.env.UV_PYTHON_INSTALL_DIR = join(this.root, 'python');
    options.env.UV_CACHE_DIR = join(this.root, 'cache');
    await run(uv, ['venv', '--managed-python', '--python', '3.12', join(this.root, 'venv')], options);
    this.status.message = '正在安装分离引擎…';
    await run(uv, ['pip', 'install', '--python', python, 'torch==2.5.1', 'torchaudio==2.5.1',
      ...(process.platform === 'darwin' ? [] : ['--index-url', 'https://download.pytorch.org/whl/cpu'])], options);
    await run(uv, ['pip', 'install', '--python', python, '-r', join(backend, 'requirements.txt')], options);
    this.status.message = '正在准备分离模型…';
    await run(python, ['-I', '-u', join(backend, 'check_environment.py'), join(this.root, 'models')], options);
    this.status = { stage: 'ready', message: '分离环境已就绪', pythonPath: python };
  }
}
