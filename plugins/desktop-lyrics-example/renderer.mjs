let root, api, lines = [], time = 0, abort;
function paint() {
  const active = lines.filter(line => Number.isFinite(line.time) && line.time <= time).at(-1);
  root.querySelector('p').textContent = active?.text || '暂无歌词';
}
export default {
  mount(element, bridge) {
    root = element; api = bridge; abort = new AbortController();
    root.innerHTML = `<style>body{margin:0;background:transparent;color:white;font-family:system-ui}article{margin:12px;padding:20px;border-radius:18px;background:#18232ce8}header{cursor:grab;display:flex;justify-content:space-between}p{font-size:var(--size,24px);line-height:1.6;min-height:180px;white-space:pre-wrap}button{border:0;border-radius:8px;padding:8px 12px;background:#ffffff20;color:white;cursor:pointer}</style><article><header><span>桌面歌词</span><button data-action="close">关闭</button></header><h3></h3><p></p><button data-action="togglePlayback">播放 / 暂停</button></article>`;
    root.addEventListener('click', event => { const action = event.target.closest('[data-action]')?.dataset.action; if (action) api.post(action); }, { signal:abort.signal });
    root.querySelector('header').addEventListener('pointerdown', event => { if (event.button === 0 && !event.target.closest('button')) api.post('dragWindow'); }, { signal:abort.signal });
    paint();
  },
  update(message) {
    if (message.type === 'track') { lines = []; root.querySelector('h3').textContent = message.activeTrack?.title || '等待播放'; }
    if (message.type === 'lyrics') lines = message.lines || [];
    if (message.type === 'playback') time = message.playback.currentTime;
    if (message.type === 'config') root.style.setProperty('--size', `${Math.max(16, Math.min(36, Number(message.config.fontSize) || 24))}px`);
    paint();
  },
  destroy() { abort?.abort(); root?.replaceChildren(); root = api = null; lines = []; time = 0; }
};
