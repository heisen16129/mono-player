import { ref, watch, type Ref } from 'vue';
import { readPersistentValue, writePersistentValue } from '../services/persistentStore';

const SEARCH_HISTORY_KEY = 'search.history';
const EXCLUDED_SEARCH_HISTORY_KEYWORDS = new Set(['热门歌曲', '热门歌手']);

export function useSearchHistory(limit: Ref<number>) {
  const searchHistory = ref<string[]>([]);

  async function loadSearchHistory() {
    const storedHistory = await readPersistentValue<string[]>(SEARCH_HISTORY_KEY);
    searchHistory.value = (storedHistory ?? [])
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => Boolean(item) && !EXCLUDED_SEARCH_HISTORY_KEYWORDS.has(item))
      .slice(0, limit.value);
    await writePersistentValue(SEARCH_HISTORY_KEY, searchHistory.value);
  }

  async function saveSearchHistory(keyword: string) {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword || EXCLUDED_SEARCH_HISTORY_KEYWORDS.has(normalizedKeyword)) return;

    searchHistory.value = [
      normalizedKeyword,
      ...searchHistory.value.filter((item) => item !== normalizedKeyword),
    ].slice(0, limit.value);
    await writePersistentValue(SEARCH_HISTORY_KEY, searchHistory.value);
  }

  watch(limit, async (nextLimit) => {
    if (searchHistory.value.length <= nextLimit) return;
    searchHistory.value = searchHistory.value.slice(0, nextLimit);
    await writePersistentValue(SEARCH_HISTORY_KEY, searchHistory.value);
  });

  return {
    loadSearchHistory,
    saveSearchHistory,
    searchHistory,
  };
}
