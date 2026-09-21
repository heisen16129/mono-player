import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const bytes = readFileSync(new URL('../plugins/stem-separation/dist/stem-separation.wasm', import.meta.url));
const { instance } = await WebAssembly.instantiate(bytes);
const { memory, mono_alloc, mono_invoke, mono_last_len, mono_dealloc } = instance.exports;

function invoke(request) {
  const input = Buffer.from(JSON.stringify(request));
  const pointer = mono_alloc(input.length);
  new Uint8Array(memory.buffer, pointer, input.length).set(input);
  const output = mono_invoke(pointer, input.length);
  const length = mono_last_len();
  const response = JSON.parse(Buffer.from(memory.buffer, output, length).toString('utf8'));
  mono_dealloc(pointer, input.length);
  mono_dealloc(output, length);
  return response;
}

test('packaged WASM exposes an installable tool manifest', () => {
  const response = invoke({ action: 'metadata' });
  assert.equal(response.code, 1);
  const metadata = response.data;
  assert.equal(metadata.id, 'mono-wasm-stem-separation');
  assert.equal(metadata.kind, 'tool');
  assert.deepEqual(metadata.capabilities, ['stem-separation']);
  assert.deepEqual(metadata.permissions, ['audio-process', 'network']);
  assert(metadata.configSchema.fields.some(field => field.key === 'pythonPath'));
});

test('packaged WASM returns only a constrained separation plan', () => {
  for (const device of ['auto', 'cpu', 'cuda', 'mps']) {
    const response = invoke({ action: 'separate', config: { device, pythonPath: 'ignored.exe' } });
    assert.deepEqual(response, { code: 1, message: 'OK', data: { engine: 'demucs', model: 'htdemucs_6s', device } });
  }
  assert.equal(invoke({ action: 'separate', config: { device: 'shell' } }).code, 0);
  assert.equal(invoke({ action: 'unknown' }).code, 0);
});
