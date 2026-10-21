import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Jobs, collect, cacheKey } from './jobs.mjs';

function fixture(t, runner) {
  const base = resolve('target/stem-plugin-tests'); mkdirSync(base, { recursive: true });
  const root = mkdtempSync(join(base, 'job-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, '歌曲.mp3'); writeFileSync(source, 'fixture');
  const environment = { root: join(root, 'environment'), busy: () => false, status: { stage: 'ready', pythonPath: 'fixture' } };
  return { root, source, jobs: new Jobs(root, environment, async () => ({ device: 'cpu' }), runner) };
}
test('plugin owns batch execution, publishes completed results and reuses the cache', async t => {
  let runs = 0;
  const { source, jobs } = fixture(t, async (_, args, { onLine }) => {
    runs++; const request = JSON.parse(args.at(-1));
    onLine(JSON.stringify({ stage: 'separating', progress: 50 }));
    writeFileSync(join(request.outputDir, 'vocals.wav'), 'vocals');
    writeFileSync(join(request.outputDir, 'accompaniment.wav'), 'music');
  });
  jobs.start(source); const taskId = jobs.task.id;
  await jobs.pending;
  assert.equal(jobs.task.id, taskId); assert.equal(jobs.batch.stage, 'done');
  assert.equal(jobs.task.stage, 'done'); assert.ok(jobs.cached(source));
  jobs.start(source); await jobs.pending; assert.equal(runs, 1);
});
test('cancellation terminates the task and removes incomplete outputs', async t => {
  let started;
  const running = new Promise(resolve => { started = resolve; });
  const { source, jobs } = fixture(t, async (_, args, { signal }) => {
    const request = JSON.parse(args.at(-1)); writeFileSync(join(request.outputDir, 'vocals.wav'), 'partial');
    started(); await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
  });
  jobs.start(source); await running; jobs.cancel(); await jobs.pending;
  assert.equal(jobs.batch.stage, 'cancelled'); assert.equal(jobs.task.stage, 'cancelled');
  assert.equal(jobs.cached(source), null); assert.deepEqual(readdirSync(join(jobs.output, cacheKey(source))), []);
});
test('incomplete output fails and batch cannot overlap an existing task', async t => {
  const { source, jobs } = fixture(t, async () => {});
  jobs.start(source); assert.throws(() => jobs.start(source)); await jobs.pending;
  assert.equal(jobs.batch.stage, 'error'); assert.equal(jobs.cached(source), null);
  assert.equal(existsSync(join(jobs.output, cacheKey(source), 'ready.txt')), false);
});
test('directory scanning excludes generated outputs and non-audio files', t => {
  const { root, source, jobs } = fixture(t, async () => {});
  writeFileSync(join(root, 'note.txt'), 'ignore'); writeFileSync(join(jobs.output, 'generated.wav'), 'ignore');
  assert.deepEqual(collect(root, jobs.output), [source]);
});
