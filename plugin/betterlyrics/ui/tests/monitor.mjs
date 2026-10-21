// Preview-only DOM sampler: compare consecutive frames during uninterrupted playback.
export function monitorPlayback() {
  let previous = null, frames = 0, backwards = 0, reversals = 0, rebuilds = 0, lastReport = 0;
  function sample(now) {
    const scroll = document.querySelector('.lyrics-scroll');
    const active = scroll?.querySelector('.lyric-line.active');
    if (active && document.querySelector('.betterlyrics.playing') && !scroll.classList.contains('browsing')) {
      const current = { first: scroll.firstElementChild, index: Number(active.dataset.line), position: scroll.dataset.style === 'vertical' ? scroll.scrollLeft : scroll.scrollTop };
      if (previous) {
        if (current.index < previous.index) backwards++;
        if (current.position < previous.position - 2) reversals++;
        if (current.first !== previous.first) rebuilds++;
      }
      previous = current; frames++;
    } else previous = null;
    if (now - lastReport > 1000) {
      parent.postMessage({type:'stability',frames,backwards,reversals,rebuilds}, '*'); lastReport = now;
    }
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
}
