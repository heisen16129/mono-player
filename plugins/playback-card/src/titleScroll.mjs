// Keep short titles still; reveal overflowing vertical titles without restarting on playback ticks.
export function createTitleScroll(viewport, text) {
  let animation, signature = '';
  return {
    update(style) {
      const distance = style === 'ancient' ? Math.max(0, text.offsetHeight - viewport.clientHeight) : 0;
      const next = JSON.stringify([style, text.textContent, distance]);
      if (signature === next) return;
      signature = next;
      animation?.cancel();
      animation = null;
      if (!distance) return;
      animation = text.animate([
        { transform: 'translateY(0)', offset: 0 },
        { transform: 'translateY(0)', offset: 0.15 },
        { transform: `translateY(-${distance}px)`, offset: 0.85 },
        { transform: `translateY(-${distance}px)`, offset: 1 },
      ], { duration: Math.max(6000, distance * 65), iterations: Infinity, direction: 'alternate', easing: 'linear' });
    },
    destroy() { animation?.cancel(); },
  };
}
