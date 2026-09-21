import { invokeApi } from './api';
import type { StemSeparationStatus } from '../types/stemSeparation';

export function setKaraokeVocals(source: string, gain: number) {
  return invokeApi<void>('karaoke_set_vocals', { source, gain });
}

export function hasKaraokeAccompaniment(source: string, providerId?: string | null, trackId?: string | null) {
  return invokeApi<boolean>('karaoke_has_accompaniment', { source, providerId: providerId ?? null, trackId: trackId ?? null });
}

export function resolveKaraokePlaybackSource(source: string, providerId?: string | null, trackId?: string | null) {
  return invokeApi<string | null>('karaoke_playback_source', { source, providerId: providerId ?? null, trackId: trackId ?? null });
}

export function prepareKaraoke(pluginId: string, source: string, checkOnly = false) {
  return invokeApi<{ accompaniment: string | null; job: StemSeparationStatus | null }>('karaoke_prepare', { pluginId, source, checkOnly });
}

export function switchKaraoke(pluginId: string, source: string, accompaniment: string | null) {
  return invokeApi<void>('karaoke_switch', { pluginId, source, accompaniment });
}
