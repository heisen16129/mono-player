// SPDX-License-Identifier: GPL-3.0-only
import { artwork, clamp } from '../state.mjs';

export function createBackground(elements) {
  const { app, get } = elements;
  const background = get('.background'), video = get('video');
  const washes = [...app.querySelectorAll('.wash')];
  let videoUrl = '';
  function update(state) {
    const host = state.config.backgroundMode === 'host';
    const data = state.background;
    const source = host ? data.source : 'cover';
    const native = source === 'wallpaper' && data.wallpaperProjectType === 'scene';
    const media = source === 'media' || source === 'wallpaper';
    const url = media ? data.mediaUrl || '' : source === 'cover' ? artwork(state.track) : '';
    const isVideo = media && data.mediaKind === 'video' && Boolean(url);
    app.dataset.background = host ? 'host' : state.config.backgroundMode;
    app.style.background = native ? 'transparent' : '';
    background.style.background = native ? 'transparent' : source === 'color' ? data.color || '#172b37' : '';
    background.style.opacity = String(host ? clamp(Number(data.windowOpacity ?? 1), 0, 1) : 1);
    get('.shade').hidden = native || source === 'color';
    const opacity = host ? clamp(Number(data.opacity ?? .85), 0, 1) : .85;
    for (const wash of washes) {
      wash.style.backgroundImage = url && !isVideo && !native ? `url(${JSON.stringify(url)})` : '';
      wash.style.display = isVideo || native || source === 'color' ? 'none' : '';
      wash.style.filter = host ? `blur(${clamp(Number(data.blur || 0), 0, 100)}px)` : '';
      wash.style.opacity = host ? String(opacity) : '';
      wash.style.backgroundPosition = host ? `${data.positionX ?? 50}% ${data.positionY ?? 50}%` : '';
      wash.style.transform = host ? `scale(${clamp(Number(data.scale || 1), .5, 2) * 1.1})` : '';
    }
    if (host) washes[1].style.display = 'none';
    video.style.display = isVideo ? 'block' : 'none';
    video.style.opacity = String(opacity);
    video.style.filter = `blur(${clamp(Number(data.blur || 0), 0, 100)}px)`;
    video.style.objectPosition = `${data.positionX ?? 50}% ${data.positionY ?? 50}%`;
    if (isVideo && videoUrl !== url) {
      videoUrl = url; video.src = url; void video.play().catch(() => {});
    } else if (!isVideo && videoUrl) { video.pause(); video.removeAttribute('src'); video.load(); videoUrl = ''; }
  }
  return { update, destroy() { video.pause(); video.removeAttribute('src'); video.load(); } };
}
