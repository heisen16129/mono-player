import { invoke } from '@tauri-apps/api/core';

export type ApiResponse<T> = {
  code: 1 | 0;
  message: string;
  data: T | null;
};

function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return Boolean(
    value
      && typeof value === 'object'
      && 'code' in value
      && 'message' in value
      && 'data' in value,
  );
}

export async function invokeApi<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const response = await invoke<ApiResponse<T> | T>(command, args);
  if (!isApiResponse<T>(response)) return response as T;
  if (response.code !== 1) {
    throw new Error(response.message || '操作失败');
  }
  return response.data as T;
}
