import { computed } from 'vue';
import type {
  PlaylistContextMenuListeners,
  PlaylistContextMenuModel,
  PlaylistContextMenuProps,
  TrackContextMenuListeners,
  TrackContextMenuModel,
  TrackContextMenuProps,
} from '../types/appContextMenus';

interface UseAppContextMenuBindingsOptions {
  playlist: {
    listeners: PlaylistContextMenuListeners;
    locale: () => PlaylistContextMenuProps['locale'];
    menu: () => PlaylistContextMenuModel | null;
  };
  track: {
    activePlaylistId: () => TrackContextMenuProps['activePlaylistId'];
    canChangeCover: () => TrackContextMenuProps['canChangeCover'];
    canEditMetadata: () => TrackContextMenuProps['canEditMetadata'];
    canRefreshDuration: () => TrackContextMenuProps['canRefreshDuration'];
    isDownloaded: (menu: TrackContextMenuModel) => TrackContextMenuProps['isDownloaded'];
    isFavorite: (menu: TrackContextMenuModel) => TrackContextMenuProps['isFavorite'];
    listeners: TrackContextMenuListeners;
    locale: () => TrackContextMenuProps['locale'];
    menu: () => TrackContextMenuModel | null;
  };
}

export function useAppContextMenuBindings({ playlist, track }: UseAppContextMenuBindingsOptions) {
  const playlistContextMenuProps = computed<PlaylistContextMenuProps | null>(() => {
    const menu = playlist.menu();
    if (!menu) return null;

    return {
      menu,
      locale: playlist.locale(),
    };
  });

  const trackContextMenuProps = computed<TrackContextMenuProps | null>(() => {
    const menu = track.menu();
    if (!menu) return null;

    return {
      activePlaylistId: track.activePlaylistId(),
      canEditMetadata: track.canEditMetadata(),
      canChangeCover: track.canChangeCover(),
      canRefreshDuration: track.canRefreshDuration(),
      isDownloaded: track.isDownloaded(menu),
      isFavorite: track.isFavorite(menu),
      locale: track.locale(),
      menu,
    };
  });

  return {
    playlistContextMenuListeners: playlist.listeners,
    playlistContextMenuProps,
    trackContextMenuListeners: track.listeners,
    trackContextMenuProps,
  };
}
