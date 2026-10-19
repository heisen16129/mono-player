import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const source = readFileSync('src/services/plugins.ts', 'utf8')
  .replace(/^import[\s\S]*?from [^;]+;\r?\n/gm, '')
  .replace(/export /g, '');
const { code } = await transform(source, { loader: 'ts' });

test('batch isolates progress events and always removes its listener after failure', async () => {
  let listener, removed = 0;
  const progress = [];
  const context = vm.createContext({
    crypto: { randomUUID: () => 'request-one' },
    listen: async (_event, handler) => { listener = handler; return () => removed++; },
    invokeApi: async () => {
      listener({ payload: { requestId: 'another', completed: 9, total: 9 } });
      listener({ payload: { requestId: 'request-one', completed: 1, total: 2 } });
      throw new Error('connection lost');
    },
  });
  vm.runInContext(code, context);
  await assert.rejects(context.batchPluginActions([], (done, total) => progress.push([done, total])), /connection lost/);
  assert.deepEqual(progress, [[1, 2]]);
  assert.equal(removed, 1);
});

test('batch returns per-item failures without losing successful results', async () => {
  let removed = false;
  const results = [{ id: 'a', success: true }, { id: 'b', success: false, error: 'invalid package' }];
  const context = vm.createContext({
    crypto: { randomUUID: () => 'batch' },
    listen: async () => () => { removed = true; },
    invokeApi: async () => results,
  });
  vm.runInContext(code, context);
  assert.equal(await context.batchPluginActions([]), results);
  assert.equal(removed, true);
});
