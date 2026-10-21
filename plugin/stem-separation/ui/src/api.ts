import { mono } from './mono';
import type { StemBatchStatus, StemEnvironmentStatus, StemSeparationStatus } from './types/stemSeparation';
let connection: Promise<{url:string;token:string}> | undefined;
async function call<T>(method: string, params: unknown = {}): Promise<T> {
  const service = await (connection ??= mono.service.getConnection());
  const response = await fetch(`${service.url}rpc`, { method: 'POST',
    headers: { Authorization: `Bearer ${service.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params }) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || '分离服务请求失败');
  return payload.data;
}
export const separation = {
  chooseInput: (kind: 'file' | 'directory') => mono.files.choose(kind),
  revealOutput: (path: string) => mono.files.reveal(path),
  getEnvironment: () => call<StemEnvironmentStatus>('getEnvironment'),
  checkEnvironment: () => call<StemEnvironmentStatus>('checkEnvironment'),
  prepareEnvironment: () => call<StemEnvironmentStatus>('prepareEnvironment'),
  cancelEnvironment: () => call<void>('cancelEnvironment'),
  getTask: () => call<StemSeparationStatus | null>('getTask'),
  getBatch: () => call<StemBatchStatus | null>('getBatch'),
  startBatch: (source: string) => call<StemBatchStatus>('startBatch', { source }),
  cancelBatch: () => call<void>('cancelBatch'),
  getOutputDirectory: () => call<string>('getOutputDirectory'),
};
