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
  let response: ApiResponse<T> | T;
  try {
    response = await invoke<ApiResponse<T> | T>(command, args);
  } catch (error) {
    console.error('[api] invoke failed', { command, args, error });
    throw error;
  }
  if (!isApiResponse<T>(response)) return response as T;
  if (response.code !== 1) {
    console.error('[api] response error', { command, args, message: response.message });
    throw new Error(response.message || '操作失败');
  }
  return response.data as T;
}
