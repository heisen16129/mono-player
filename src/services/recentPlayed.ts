import { invokeApi } from './api';
import type { Track } from '../types/music';

export const listRecentlyPlayedTracks = () => invokeApi<Track[]>('list_recently_played_tracks');
