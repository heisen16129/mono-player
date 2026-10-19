import { onScopeDispose, ref, watch, type Ref } from 'vue';
import { t } from '../i18n';
import { isTauriRuntime } from '../services/music';
import { readLibraryStatistics } from '../services/libraryStatistics';
import type { LibraryStatistics } from '../types/library';
import type { PlayerSettings, Track } from '../types/music';
import { getErrorMessage } from '../utils/error';

export function useLibraryStatistics({ tracks, settings, query, error }: {
  tracks: Ref<Track[]>;
  settings: Ref<PlayerSettings>;
  query: Ref<string>;
  error: Ref<string | null>;
}) {
  const libraryStatistics = ref<LibraryStatistics>({ artists: [], artistCount: 0, artistTrackCount: 0, folders: [], folderTrackCount: 0 });
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function refreshLibraryStatistics(requestRevision = ++revision) {
    clearTimeout(timer);
    if (!isTauriRuntime()) return;
    try {
      const next = await readLibraryStatistics([...settings.value.musicDirs], query.value, t(settings.value.locale, 'unknownArtist'));
      if (requestRevision === revision) libraryStatistics.value = next;
    } catch (err) {
      if (requestRevision === revision) error.value = getErrorMessage(err);
    }
  }

  watch(
    () => [tracks.value, settings.value.musicDirs, query.value, settings.value.locale],
    () => {
      const requestRevision = ++revision;
      clearTimeout(timer);
      if (!isTauriRuntime()) return;
      timer = setTimeout(() => refreshLibraryStatistics(requestRevision), 100);
    },
    { immediate: true, deep: true },
  );
  onScopeDispose(() => { ++revision; clearTimeout(timer); });
  return { libraryStatistics, refreshLibraryStatistics };
}
