import { cardLines } from './lyrics.mjs';
import { createTitleScroll } from './titleScroll.mjs';

export function createLyricPanel(container) {
  let signature = '';
  return (lines, time, style, fallback) => {
    let count = style === 'journal' ? 7 : ['cinematic', 'polaroid', 'vinyl', 'receipt'].includes(style) ? 2 : style === 'cd' ? 3 : 4;
    let rows = cardLines(lines, time, count);
    if (!rows.length) rows.push({ text: fallback, secondary: '', active: false });
    const next = JSON.stringify([style, rows]);
    if (signature === next) return;
    signature = next;
    function render() { container.getAnimations({ subtree: true }).forEach(animation => animation.cancel()); container.replaceChildren(...rows.map(row => {
      const item = document.createElement('div'); item.className = 'lyric-row';
      item.dataset.active = String(row.active);
      const main = document.createElement('p'); main.className = 'lyric-text';
      if (style === 'ancient') {
        const text = document.createElement('span'); text.className = 'vertical-lyric-text'; text.textContent = row.text; main.append(text);
      } else main.textContent = row.text;
      main.title = row.text; item.append(main);
      if (row.secondary) {
        const secondary = document.createElement('p'); secondary.className = 'lyric-secondary';
        secondary.textContent = row.secondary; secondary.title = row.secondary; item.append(secondary);
      }
      return item;
    })); }
    render();
    // Reduce the paragraph count instead of clipping a translation or the active line.
    while (rows.length > 1 && (container.scrollHeight > container.clientHeight + 1 || container.scrollWidth > container.clientWidth + 1)) {
      count -= 1;
      rows = cardLines(lines, time, count);
      render();
    }
    if (style === 'ancient') container.querySelectorAll('.lyric-text').forEach(main => createTitleScroll(main, main.firstElementChild).update(style));
  };
}
