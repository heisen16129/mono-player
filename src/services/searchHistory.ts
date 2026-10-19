import { invokeApi } from './api';
import { isTauriRuntime } from './music';

export function updateSearchHistory(action: 'list' | 'record' | 'remove' | 'clear', limit: number, keyword?: string) {
  if (!isTauriRuntime()) return Promise.resolve<string[]>([]);
  return invokeApi<string[]>('update_search_history', { action, limit, keyword: keyword ?? null });
}
