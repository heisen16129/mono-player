import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, mkdirSync, realpathSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createMono } from '../../../packages/plugin-sdk/dist/client.mjs';
import { Environment } from './environment.mjs';
import { Jobs, inside } from './jobs.mjs';

const [connectionFile, data] = process.argv.slice(2);
mkdirSync(data, { recursive: true });
const connection = JSON.parse(readFileSync(connectionFile, 'utf8'));
const endpoint = new URL(connection.endpoint);
if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1') throw new Error('无效宿主连接');
let receive;
const mono = createMono({ subscribe(listener) { receive = listener; return () => { receive = undefined; }; },
  send(request) {
    fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${connection.sessionToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
      .then(r => r.json()).then(response => receive?.(response))
      .catch(error => receive?.({ requestId: request.requestId, ok: false, error: { code: 'INTERNAL', message: error.message } }));
  } });
const config = () => mono.config.get();
const environment = new Environment(join(data, 'environment'), config);
const jobs = new Jobs(data, environment, config);
const token = randomBytes(32).toString('hex');
const authorized = value => { const a = Buffer.from(value || ''), b = Buffer.from(`Bearer ${token}`); return a.length === b.length && timingSafeEqual(a,b); };
const methods = {
  getEnvironment: () => environment.status,
  checkEnvironment: () => { if (jobs.busy()) throw new Error('分离任务正在运行'); return environment.begin(); },
  prepareEnvironment: () => { if (jobs.busy()) throw new Error('分离任务正在运行'); return environment.begin(true); },
  cancelEnvironment: () => environment.cancel(),
  getBatch: () => jobs.snapshot(), getTask: () => jobs.task,
  startBatch: ({ source }) => jobs.start(source), cancelBatch: ({ taskId } = {}) => {
    if (taskId && taskId !== jobs.task?.id) throw new Error('分离任务已改变');
    return jobs.cancel();
  },
  getOutputDirectory: () => jobs.output,
  prepareKaraoke: ({ source, checkOnly = false }) => {
    const cached = jobs.cached(source);
    if (cached || checkOnly) return { accompaniment: cached?.accompanimentPath ?? null, job: null };
    jobs.start(source); return { accompaniment: null, job: jobs.task ?? { id: jobs.batch.id, stage: 'loading', pluginId: 'mono-wasm-stem-separation' } };
  },
  validateOutput: ({ path }) => {
    const full = realpathSync(path), root = realpathSync(jobs.output);
    if (!inside(root, full)) throw new Error('无效输出文件');
    return { path: full, name: basename(full) };
  },
};
const server = http.createServer(async (req,res) => {
  const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (req.headers.host !== `127.0.0.1:${server.address().port}`) return json(403, { error: 'Invalid host' });
  if (req.headers.origin === 'null') {
    res.setHeader('Access-Control-Allow-Origin', 'null'); res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.headers['access-control-request-private-network'] === 'true') res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  }
  if (!authorized(req.headers.authorization)) return json(403, { error: 'Unauthorized' });
  if (req.method !== 'POST' || req.url !== '/rpc') return json(404, { error: 'Not found' });
  try {
    let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 65536) throw new Error('Request too large'); }
    const { method, params = {} } = JSON.parse(body);
    if (!Object.hasOwn(methods, method)) return json(400, { error: 'Unknown plugin method' });
    json(200, { data: await methods[method](params) ?? null });
  } catch (error) { json(400, { error: error.message }); }
});
server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ url: `http://127.0.0.1:${server.address().port}/#${token}` })));
async function shutdown() {
  jobs.cancel(); environment.cancel();
  await Promise.allSettled([jobs.pending, environment.pending]);
  mono.dispose(); server.closeAllConnections(); server.close();
}
process.stdin.resume(); process.stdin.on('end', shutdown);
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
