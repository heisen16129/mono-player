import { computed } from 'vue';
import { usePlayerStore } from '../stores/player';
import { artworkDisplaySrc } from '../utils/artwork';
import { useArtworkDominantColor } from './useArtworkDominantColor';

export function useLyricsColors() {
  const player = usePlayerStore();
  const cover = useArtworkDominantColor(() => artworkDisplaySrc(
    player.currentTrack?.associatedArtwork || player.currentTrack?.artwork,
  ), () => player.settings.useThemeLyricColor);
  const base = computed(() => player.settings.useThemeLyricColor
    ? cover.value || '#a9b8c8' : player.settings.lyricFontColor);
  const highlight = computed(() => player.settings.lyricHighlightColor || base.value);
  const glow = computed(() => player.settings.lyricGlowColor || highlight.value);
  return { base, highlight, glow };
}
