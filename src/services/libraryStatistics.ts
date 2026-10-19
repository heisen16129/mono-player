import { invokeApi } from './api';
import type { LibraryStatistics } from '../types/library';

export function readLibraryStatistics(directories: string[], query: string, unknownArtist: string) {
  return invokeApi<LibraryStatistics>('read_library_statistics', { directories, query, unknownArtist });
}
