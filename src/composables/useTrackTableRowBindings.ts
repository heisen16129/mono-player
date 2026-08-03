import { computed, type ComponentPublicInstance, type ComputedRef } from 'vue';
import type { Track } from '../types/music';
import type {
  TrackTableEmits,
  TrackTableHeaderProps,
  TrackTableProps,
  TrackTableRowListeners,
  TrackTableRowProps,
} from '../types/trackTable';

interface UseTrackTableRowBindingsOptions {
  albumLabel: ComputedRef<string>;
  artistLabel: ComputedRef<string>;
  canDownloadTrack: (track: Track) => boolean;
  emit: <K extends keyof TrackTableEmits>(event: K, ...args: TrackTableEmits[K]) => void;
  getDownloadActionLabel: (track: Track) => string;
  handleTrackClick: (event: MouseEvent, track: Track) => void;
  handleTrackContextMenu: (event: MouseEvent, track: Track) => void;
  isActiveRow: (track: Track) => boolean;
  isDownloadedTrack: (track: Track) => boolean;
  isFavoriteTrack: (track: Track) => boolean;
  isPendingDownloadTrack: (track: Track) => boolean;
  localMusicLabel: ComputedRef<string>;
  openTrackArtist: (track: Track) => void;
  props: TrackTableProps;
  setTrackRowRef: (trackId: number, element: Element | ComponentPublicInstance | null) => void;
  showTrackCovers: () => boolean;
  showTrackNumbers: () => boolean;
  titleLabel: ComputedRef<string>;
  toggleFavoriteLabel: ComputedRef<string>;
  unknownArtistLabel: ComputedRef<string>;
}

export function useTrackTableRowBindings({
  albumLabel,
  artistLabel,
  canDownloadTrack,
  emit,
  getDownloadActionLabel,
  handleTrackClick,
  handleTrackContextMenu,
  isActiveRow,
  isDownloadedTrack,
  isFavoriteTrack,
  isPendingDownloadTrack,
  localMusicLabel,
  openTrackArtist,
  props,
  setTrackRowRef,
  showTrackCovers,
  showTrackNumbers,
  titleLabel,
  toggleFavoriteLabel,
  unknownArtistLabel,
}: UseTrackTableRowBindingsOptions) {
  const trackTableHeaderProps = computed<TrackTableHeaderProps>(() => ({
    albumLabel: albumLabel.value,
    artistLabel: artistLabel.value,
    enableDownloadAction: props.enableDownloadAction,
    hideActionHeader: props.hideActionHeader,
    hideActionsColumn: props.hideActionsColumn,
    showFavoriteAction: props.showFavoriteAction ?? true,
    showTrackCovers: showTrackCovers(),
    showTrackNumbers: showTrackNumbers(),
    titleLabel: titleLabel.value,
  }));

  function getTrackTableRowProps(track: Track, index: number): TrackTableRowProps {
    return {
      active: isActiveRow(track),
      canDownload: canDownloadTrack(track),
      downloadActionLabel: getDownloadActionLabel(track),
      enableArtistLinks: props.enableArtistLinks,
      enableDownloadAction: props.enableDownloadAction,
      extraColumns: props.extraColumns,
      hideActionsColumn: props.hideActionsColumn,
      index,
      isDownloaded: isDownloadedTrack(track),
      isFavorite: isFavoriteTrack(track),
      isPendingDownload: isPendingDownloadTrack(track),
      isPlaying: props.isPlaying,
      localMusicLabel: localMusicLabel.value,
      preparing: props.preparingTrackId === track.id,
      rowClass: props.rowClass,
      setRowRef: (element) => setTrackRowRef(track.id, element),
      showTrackCovers: showTrackCovers(),
      showTrackNumbers: showTrackNumbers(),
      showFavoriteAction: props.showFavoriteAction ?? true,
      spectrumLevels: props.spectrumLevels ?? [],
      toggleFavoriteLabel: toggleFavoriteLabel.value,
      track,
      unknownArtistLabel: unknownArtistLabel.value,
    };
  }

  const trackTableRowListeners: TrackTableRowListeners = {
    onClick: handleTrackClick,
    onContextMenu: handleTrackContextMenu,
    onDownloadTrack: (track) => emit('downloadTrack', track),
    onOpenArtist: openTrackArtist,
    onToggleFavorite: (track) => emit('toggleFavorite', track),
  };

  return {
    getTrackTableRowProps,
    trackTableHeaderProps,
    trackTableRowListeners,
  };
}
