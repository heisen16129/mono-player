import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';

test('standalone plugin service authenticates requests, supports sandbox CORS and stops on host disconnect', async t => {
  const base = resolve('target/stem-plugin-tests'); mkdirSync(base, { recursive: true });
  const root = mkdtempSync(join(base, 'service-'));
  const bridge = http.createServer(async (req,res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    assert.equal(req.headers.authorization, 'Bearer fixture');
    const request = JSON.parse(body); assert.equal(request.method, 'config.get');
    res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ requestId: request.requestId, ok: true, data: {} }));
  });
  bridge.listen(0, '127.0.0.1'); await once(bridge, 'listening');
  const connection = join(root, 'connection.json');
  writeFileSync(connection, JSON.stringify({ endpoint: `http://127.0.0.1:${bridge.address().port}/plugin-api/v1`, sessionToken: 'fixture' }));
  const child = spawn(process.execPath, [resolve('plugin/stem-separation/dist/service.mjs'), connection, root], { windowsHide: true, env: { ...process.env, LOCALAPPDATA: root }, stdio: ['pipe','pipe','pipe'] });
  const exited = once(child, 'exit');
  t.after(async () => { child.kill(); bridge.closeAllConnections(); bridge.close(); await exited; rmSync(root, { recursive: true, force: true }); });
  let errors = ''; child.stderr.on('data', chunk => errors += chunk);
  const lines = createInterface({ input: child.stdout });
  const ready = await Promise.race([once(lines, 'line').then(([line]) => JSON.parse(line)), exited.then(([code]) => { throw new Error(`Service exited ${code}: ${errors}`); })]);
  const url = new URL(ready.url), token = url.hash.slice(1); const rpc = `${url.origin}/rpc`;
  const preflight = await fetch(rpc, { method: 'OPTIONS', headers: { Origin: 'null', 'Access-Control-Request-Private-Network': 'true' } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-private-network'), 'true');
  assert.equal((await fetch(rpc, { method: 'POST', body: '{}' })).status, 403);
  const call = async (method, params) => {
    const response = await fetch(rpc, { method: 'POST', headers: { Origin: 'null', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ method, params }) });
    assert.equal(response.headers.get('access-control-allow-origin'), 'null'); return { response, value: await response.json() };
  };
  assert.equal((await call('getEnvironment')).value.data.stage, 'idle');
  assert.equal((await call('checkEnvironment')).response.status, 200);
  let state;
  for (let i = 0; i < 50; i++) { state = (await call('getEnvironment')).value.data; if (state.stage !== 'checking') break; await new Promise(r => setTimeout(r,20)); }
  assert.equal(state.stage, 'missing');
  assert.equal((await call('startBatch', { source: 'absent' })).response.status, 400);
  assert.equal((await call('unknown')).response.status, 400);
  assert.equal((await call('cancelBatch', { taskId: 'stale-task' })).response.status, 400);
  assert.equal((await call('getBatch')).value.data, null);
  child.stdin.end(); const [code] = await exited; assert.equal(code, 0);
});
