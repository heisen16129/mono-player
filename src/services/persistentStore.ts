import { invoke } from '@tauri-apps/api/core';

export async function readPersistentValue<T>(key: string): Promise<T | null> {
  return await invoke<T | null>('store_get', { key });
}

export async function writePersistentValue<T>(key: string, value: T): Promise<void> {
  await invoke('store_set', { key, value });
}

export async function removePersistentValue(key: string): Promise<void> {
  await invoke('store_delete', { key });
}
