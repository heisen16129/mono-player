import type { MaybeRefOrGetter } from 'vue';
import { toValue } from 'vue';
import { t } from '../i18n';
import type { Locale, Track } from '../types/music';

interface TrackTableInteractionOptions {
  enableContextMenu?: MaybeRefOrGetter<boolean | undefined>;
  getLocale: () => Locale;
  onOpenArtist: (artistName: string) => void;
  onOpenTrackMenu: (track: Track, x: number, y: number) => void;
  onPlayTrack: (track: Track) => void;
  onSelectTrack: (track: Track) => void;
}

export function useTrackTableInteractions(options: TrackTableInteractionOptions) {
  function handleTrackClick(event: MouseEvent, track: Track) {
    if (event.detail >= 2) {
      options.onPlayTrack(track);
      return;
    }

    options.onSelectTrack(track);
  }

  function openTrackArtist(artistName: string) {
    options.onOpenArtist(artistName.trim() || t(options.getLocale(), 'unknownArtist'));
  }

  function handleTrackContextMenu(event: MouseEvent, track: Track) {
    if (!toValue(options.enableContextMenu)) return;

    event.preventDefault();
    event.stopPropagation();
    options.onSelectTrack(track);
    options.onOpenTrackMenu(track, event.clientX, event.clientY);
  }

  return {
    handleTrackClick,
    handleTrackContextMenu,
    openTrackArtist,
  };
}
