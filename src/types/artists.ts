import type { Track } from './music';

export interface ArtistTrackListProps {
  activeTrack: Track | null;
  favoriteTrackIds: number[];
  isPlaying: boolean;
  label: string;
  spectrumLevels: number[];
  tracks: Track[] | null;
}

export interface ArtistTrackListEmits {
  openTrackMenu: [track: Track, x: number, y: number];
  playTrack: [track: Track];
  selectTrack: [track: Track];
  toggleFavorite: [track: Track];
}

export interface ArtistTrackListListeners {
  onOpenTrackMenu: (...args: ArtistTrackListEmits['openTrackMenu']) => void;
  onPlayTrack: (...args: ArtistTrackListEmits['playTrack']) => void;
  onSelectTrack: (...args: ArtistTrackListEmits['selectTrack']) => void;
  onToggleFavorite: (...args: ArtistTrackListEmits['toggleFavorite']) => void;
}
