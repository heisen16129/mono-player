export function createSeek(bar, post, signal) {
  let duration = 0, dragging = false, value = 0;
  function show(time) {
    value = Math.max(0, Math.min(duration, time));
    bar.firstElementChild.style.width = `${duration ? value / duration * 100 : 0}%`;
    bar.setAttribute('aria-valuenow', String(value));
  }
  function locate(event) {
    const rect = bar.getBoundingClientRect();
    show((event.clientX - rect.left) / rect.width * duration);
  }
  bar.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !duration) return;
    event.preventDefault(); dragging = true;
    bar.setPointerCapture(event.pointerId); locate(event);
  }, { signal });
  bar.addEventListener('pointermove', event => { if (dragging) locate(event); }, { signal });
  bar.addEventListener('pointerup', event => {
    if (!dragging) return;
    locate(event); dragging = false;
    bar.releasePointerCapture(event.pointerId);
    post('seekTime', { time: value });
  }, { signal });
  bar.addEventListener('lostpointercapture', () => { dragging = false; }, { signal });
  bar.addEventListener('pointercancel', () => { dragging = false; }, { signal });
  bar.addEventListener('keydown', event => {
    if (!duration || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    show(event.key === 'Home' ? 0 : event.key === 'End' ? duration : value + (event.key === 'ArrowLeft' ? -5 : 5));
    post('seekTime', { time: value });
  }, { signal });
  return { update(time, length) {
    duration = Math.max(0, Number(length) || 0);
    bar.setAttribute('aria-valuemax', String(duration));
    bar.setAttribute('aria-disabled', String(!duration));
    if (!dragging) show(time);
  } };
}
