import { ref, watch, type Ref } from 'vue';
import { updateSearchHistory } from '../services/searchHistory';

export function useSearchHistory(limit: Ref<number>) {
  const searchHistory = ref<string[]>([]);
  let pending = Promise.resolve();

  function update(action: 'list' | 'record' | 'remove' | 'clear', keyword?: string) {
    const requestedLimit = limit.value;
    const operation = pending.then(async () => {
      searchHistory.value = await updateSearchHistory(action, requestedLimit, keyword);
    });
    pending = operation.catch(() => {});
    return operation;
  }

  const loadSearchHistory = () => update('list');
  const saveSearchHistory = (keyword: string) => update('record', keyword);
  const removeSearchHistory = (keyword: string) => update('remove', keyword);
  const clearSearchHistory = () => update('clear');

  watch(limit, () => { void loadSearchHistory().catch(error => console.error('[search-history]', error)); });

  return { clearSearchHistory, loadSearchHistory, removeSearchHistory, saveSearchHistory, searchHistory };
}
