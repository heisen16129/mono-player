import { spawn } from 'node:child_process';

export function run(program, args, { signal, env, onLine, input, timeout = 1_800_000 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('已取消'));
    const child = spawn(program, args, { windowsHide: true, env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let tail = '', buffer = '', settled = false, eventError;
    const stop = () => {
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.on('error', () => child.kill());
      } else child.kill();
    };
    const timer = setTimeout(stop, timeout);
    signal?.addEventListener('abort', stop, { once: true });
    const finish = error => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', stop);
      error ? reject(error) : resolve(tail);
    };
    child.stderr.on('data', data => { tail = (tail + data.toString()).slice(-16000); });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', data => {
      buffer += data;
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        try { onLine?.(line); } catch (error) { eventError = error; stop(); }
      }
    });
    child.on('error', finish);
    child.on('close', code => finish(signal?.aborted ? new Error('已取消') : eventError || (code === 0 ? null : new Error(tail || `进程退出：${code}`))));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
