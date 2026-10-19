import type { Track } from '../types/music';
import { trackArtworkSource, usableArtworkDisplaySrc } from '../utils/artwork';

export async function preloadStartupCovers(tracks: Track[]) {
  if (typeof Image === 'undefined') return;
  const sources = new Set(tracks.map(track => usableArtworkDisplaySrc(trackArtworkSource(track), undefined, track.coverVersion)).filter(Boolean));
  await Promise.all([...sources].map(source => new Promise<void>(resolve => {
    const image = new Image();
    const finish = () => { clearTimeout(timer); image.onload = null; image.onerror = null; resolve(); };
    // A missing or unreachable cover must not keep the application on the loading screen.
    const timer = setTimeout(finish, 3000);
    image.onload = finish;
    image.onerror = finish;
    image.src = source;
  })));
}
