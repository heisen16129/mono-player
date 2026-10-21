import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['packages/plugin-sdk/src/client.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { createMono } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

function setup(timeoutMs = 1000) {
  const sent = [];
  let receive, stopped = 0;
  const mono = createMono({ send: request => sent.push(request), subscribe: listener => { receive = listener; return () => stopped++; } }, { timeoutMs });
  return { mono, sent, reply: response => receive(response), stopped: () => stopped };
}

test('out of order replies resolve only their requests; duplicate replies are ignored', async () => {
  const { mono, sent, reply } = setup();
  const a = mono.library.getTrack('track:1');
  const b = mono.library.getTrack('track:2');
  assert.equal(sent[0].apiVersion, 1);
  assert.deepEqual(sent[0].params, { trackId: 'track:1' });
  reply({ requestId: sent[1].requestId, ok: true, data: { id: 'track:2' } });
  reply({ requestId: sent[0].requestId, ok: true, data: { id: 'track:1' } });
  reply({ requestId: sent[0].requestId, ok: true, data: { id: 'wrong' } });
  assert.deepEqual(await Promise.all([a,b]), [{ id: 'track:1' }, { id: 'track:2' }]);
  mono.dispose();
});

test('permission failures keep structured error code', async () => {
  const { mono, sent, reply } = setup();
  const result = mono.library.listTracks();
  reply({ requestId: sent[0].requestId, ok: false, error: { code: 'PERMISSION_DENIED', message: 'Denied' } });
  await assert.rejects(result, { code: 'PERMISSION_DENIED' });
  mono.dispose();
});

test('timeout does not retry writes', async () => {
  const { mono, sent } = setup(10);
  await assert.rejects(mono.config.set({ value: 1 }), { code: 'TIMEOUT' });
  assert.equal(sent.length, 1);
  mono.dispose();
});

test('dispose cancels pending requests and prevents further sends', async () => {
  const { mono, sent, stopped } = setup();
  const pending = mono.host.getInfo();
  mono.dispose();
  mono.dispose();
  await assert.rejects(pending, { code: 'CANCELLED' });
  await assert.rejects(mono.host.getInfo(), { code: 'CANCELLED' });
  assert.equal(sent.length, 1);
  assert.equal(stopped(), 1);
});

test('synchronous transport failure rejects without retry', async () => {
  let sends = 0;
  const mono = createMono({ send() { sends++; throw new Error('closed'); }, subscribe() { return () => {}; } });
  await assert.rejects(mono.host.getInfo(), /closed/);
  assert.equal(sends, 1);
  mono.dispose();
});

test('file selection is a generic SDK capability and separation is not exposed', async () => {
  const { mono, sent, reply } = setup();
  assert.equal(mono.separation, undefined);
  assert.equal(mono.tasks, undefined);
  const selected = mono.files.choose('file');
  assert.equal(sent[0].method, 'files.choose');
  reply({ requestId: sent[0].requestId, ok: true, data: { reference: 'selected-file', name: '歌曲.mp3', kind: 'file' } });
  assert.equal((await selected).reference, 'selected-file');
  mono.dispose();
});

test('subscriptions stop delivery and release native subscription on disposal', async () => {
  const { mono, sent, reply } = setup();
  const delivered=[];
  const subscribe=mono.events.subscribe(['queue'], event=>delivered.push(event));
  reply({requestId:sent[0].requestId,ok:true,data:{subscriptionId:'sub-one'}});
  assert.equal(await subscribe,'sub-one');
  const poll=sent.find(r=>r.method==='events.poll');
  mono.dispose();
  assert.ok(sent.some(r=>r.method==='events.unsubscribe' && r.params.subscriptionId==='sub-one'));
  reply({requestId:poll.requestId,ok:true,data:[{topic:'queue',revision:'new',data:{}}]});
  await Promise.resolve();
  assert.equal(delivered.length,0);
});

test('queue edits carry expected revision and opaque entry IDs', async () => {
  const {mono,sent,reply}=setup();
  const edit=mono.queue.reorder(['revision:1','revision:0'],'revision');
  assert.deepEqual(sent[0].params,{entryIds:['revision:1','revision:0'],expectedRevision:'revision'});
  reply({requestId:sent[0].requestId,ok:false,error:{code:'CONFLICT',message:'Queue changed'}});
  await assert.rejects(edit,{code:'CONFLICT'});
  assert.equal(sent.length,1);
  mono.dispose();
});
