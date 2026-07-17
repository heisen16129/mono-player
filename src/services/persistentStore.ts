import { invokeApi } from './api';

export async function readPersistentValue<T>(key: string): Promise<T | null> {
  return await invokeApi<T | null>('store_get', { key });
}

export async function writePersistentValue<T>(key: string, value: T): Promise<void> {
  await invokeApi<void>('store_set', { key, value });
}

export async function removePersistentValue(key: string): Promise<void> {
  await invokeApi<void>('store_delete', { key });
}
