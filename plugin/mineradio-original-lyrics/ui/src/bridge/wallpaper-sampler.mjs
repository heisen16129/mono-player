// Native Scene pixels are sampled only beneath the existing glass controls.
// The full background remains a separate DWM surface behind the host window.
export function createWallpaperSampler(root) {
  let url = '';
  let generation = 0;
  let timer = 0;
  let pending = null;
  let layer = null;
  let imageElement = null;
  let frame = 0;

  function setReadyState(ready) {
    document.body?.classList.toggle('wallpaper-engine-dwm-active', ready);
    document.body?.classList.toggle('wallpaper-engine-glass-sampler-ready', ready);
    layer?.classList.toggle('bar-visible', ready);
  }

  function stop() {
    generation += 1;
    clearTimeout(timer);
    if (pending) { pending.onload = null; pending.onerror = null; pending = null; }
    setReadyState(false);
    imageElement?.remove();
    imageElement = null;
    layer = null;
  }

  function sample(request) {
    if (request !== generation || !url) return;
    const bar = root.querySelector('#bottom-bar');
    const rect = bar?.getBoundingClientRect();
    if (!rect || rect.width < 1 || rect.height < 1 || getComputedStyle(bar).visibility === 'hidden') {
      if (layer) layer.style.visibility = 'hidden';
      timer = setTimeout(() => sample(request), 250);
      return;
    }
    const image = new Image();
    pending = image;
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => {
      if (request !== generation) return;
      pending = null;
      if (!layer) {
        layer = root.querySelector('#wallpaper-engine-glass-sampler');
        if (!layer) return;
      }
      const bounds = bar.getBoundingClientRect();
      Object.assign(layer.style, {
        visibility: 'visible', opacity: '1', left: `${bounds.left}px`, top: `${bounds.top}px`,
        width: `${bounds.width}px`, height: `${bounds.height}px`,
        borderRadius: getComputedStyle(bar).borderRadius,
      });
      Object.assign(image.style, {
        position: 'absolute', inset: '0', width: '100%', height: '100%',
        maxWidth: 'none', objectFit: 'fill',
      });
      image.dataset.monoWallpaperSamplerFrame = '';
      imageElement?.remove();
      imageElement = image;
      layer.appendChild(image);
      setReadyState(true);
      timer = setTimeout(() => sample(request), 16);
    };
    image.onerror = () => {
      if (request !== generation) return;
      pending = null;
      timer = setTimeout(() => sample(request), 500);
    };
    const query = new URLSearchParams({
      frame: String(++frame),
      left: String(rect.left), top: String(rect.top),
      width: String(rect.width), height: String(rect.height),
      viewportWidth: String(innerWidth), viewportHeight: String(innerHeight),
    });
    image.src = `${url}?${query}`;
  }

  return {
    update(background) {
      const next = background?.source === 'wallpaper' && background.wallpaperProjectType === 'scene'
        ? String(background.wallpaperFrameUrl || '') : '';
      if (next === url) return;
      stop();
      url = next;
      if (url) sample(generation);
    },
    destroy() { stop(); url = ''; },
  };
}
