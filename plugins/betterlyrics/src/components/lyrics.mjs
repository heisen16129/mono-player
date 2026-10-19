// SPDX-License-Identifier: GPL-3.0-only
import { activeLine, wordProgress, clamp } from '../state.mjs';
import { lineDistance, lineTransform, wordEffect, fanClearance, fanTransform, fanPosition } from '../utils/lyricEffects.mjs';
import { hasWordTiming } from '../utils/stylePresets.mjs';

export function createLyricsView(elements, state, post, signal) {
  const { scroll, empty, get } = elements;
  const returnButton = get('.return-live');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let rows = [], active = -2, browseUntil = 0, movement = null, visualKey = '';

  function browse() {
    if (!state.lines.some(line => Number.isFinite(line.time))) return;
    if (!browseUntil) post('beginBrowse');
    browseUntil = performance.now() + (state.config.lyricStyle === 'fan' ? 2000 : 4000);
    movement = null;
    scroll.classList.add('browsing');
    returnButton.hidden = state.config.lyricStyle === 'fan';
  }
  function restore() {
    browseUntil = 0;
    scroll.classList.remove('browsing');
    returnButton.hidden = true;
    post('restoreRealtime');
    center();
  }
  scroll.addEventListener('wheel', event => {
    browse();
    if (state.config.lyricStyle === 'vertical') {
      event.preventDefault();
      scroll.scrollLeft += (event.deltaX || event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroll.clientWidth : 1);
    }
  }, { passive: false, signal });
  scroll.addEventListener('touchstart', browse, { passive: true, signal });
  scroll.addEventListener('touchmove', browse, { passive: true, signal });
  scroll.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) browse();
  }, { signal });
  scroll.addEventListener('click', event => {
    const row = event.target.closest('[data-line]');
    if (!row || row.disabled) return;
    post('seek', { lineIndex: Number(row.dataset.line) });
    restore();
  }, { signal });
  returnButton.addEventListener('click', restore, { signal });

  function center(immediate = false) {
    if (browseUntil || !rows.length || !state.lines.some(line => Number.isFinite(line.time))) return;
    const row = rows[Math.max(0, active)]?.node;
    if (!row) return;
    const vertical = state.config.lyricStyle === 'vertical';
    const axis = vertical ? 'scrollLeft' : 'scrollTop';
    const target = Math.max(0, vertical
      ? row.offsetLeft - scroll.clientWidth * .5 + row.offsetWidth / 2
      : row.offsetTop - scroll.clientHeight * .45 + row.offsetHeight / 2);
    if (immediate || reducedMotion.matches) { scroll[axis] = target; movement = null; }
    else movement = { from: scroll[axis], to: target, axis, at: performance.now() };
  }

  function paintBounds() {
    for (const { node } of rows) node.style.setProperty('--fan-clearance', `${fanClearance(node.offsetHeight, state.config.fanAngle)}px`);
    const width = get('.lyrics-area').clientWidth;
    const maxHeight = rows.reduce((height, row) => Math.max(height, row.node.offsetHeight), 0);
    const arcInset = get('.lyrics-area').clientHeight * .55 * Math.tan(Math.abs(state.config.fanAngle) * Math.PI / 360);
    scroll.style.setProperty('--fan-gutter', `${Math.max(width * .25, arcInset) + maxHeight * .5 + 12}px`);
    const area = get('.lyrics-area'), artwork = get('.artwork');
    const radius = fanPosition(0, area.clientHeight, Math.max(10, Math.abs(state.config.fanAngle))).radius;
    const focusY = area.getBoundingClientRect().top - artwork.getBoundingClientRect().top + area.clientHeight * .45;
    artwork.style.setProperty('--cover-radius', `${radius}px`);
    artwork.style.setProperty('--cover-center-x', `${artwork.clientWidth - 24 - radius}px`);
    artwork.style.setProperty('--cover-center-y', `${focusY}px`);
  }

  function layout() {
    const area = get('.lyrics-area');
    // Padding itself can keep the scroller larger than a shrunken viewport.
    scroll.style.setProperty('--pad', `${area.clientHeight * .5}px`);
    scroll.style.setProperty('--pad-x', `${area.clientWidth * .5}px`);
    paintBounds();
    center(true);
    active = -2;
  }
  const observer = new ResizeObserver(layout);
  // Observe the viewport, not the padded scroller: changing its padding must not
  // recursively trigger content-box ResizeObserver notifications.
  observer.observe(get('.lyrics-area'));

  function render() {
    movement = null; browseUntil = 0; active = -2;
    scroll.classList.remove('browsing'); returnButton.hidden = true;
    const fragment = document.createDocumentFragment();
    rows = state.lines.map((line, index) => {
      const node = document.createElement('button');
      node.type = 'button'; node.className = 'lyric-line'; node.dataset.line = String(index);
      node.classList.toggle('line-timed', !line.words?.length);
      node.setAttribute('aria-label', line.text || '间奏');
      node.disabled = !Number.isFinite(line.time);
      const words = [];
      if (line.words?.length) {
        for (const word of line.words) {
          const span = document.createElement('span'); span.className = 'word';
          span.setAttribute('aria-hidden', 'true');
          for (const text of Array.from(word.text)) {
            const char = document.createElement('span'); char.className = 'lyric-char';
            char.textContent = text; char.dataset.text = text; span.append(char);
          }
          node.append(span); words.push(span);
        }
      } else {
        const [primary, ...secondary] = String(line.text || '♪').split('\n');
        node.append(document.createTextNode(primary));
        if (secondary.length) {
          const translation = document.createElement('span'); translation.className = 'translation';
          translation.textContent = secondary.join('\n'); node.append(translation);
        }
      }
      fragment.append(node);
      const divider = document.createElement('span'); divider.className = 'vertical-divider';
      divider.setAttribute('aria-hidden', 'true'); fragment.append(divider);
      return { node, words, divider };
    });
    scroll.replaceChildren(fragment);
    scroll.scrollTop = 0;
    scroll.classList.toggle('unsynced', state.lines.length > 0 && state.lines.every(line => !Number.isFinite(line.time)));
    layout();
    configure();
  }

  function configure() {
    if (scroll.dataset.style !== state.config.lyricStyle) {
      movement = null; browseUntil = 0;
      scroll.classList.remove('browsing'); returnButton.hidden = true;
      scroll.dataset.style = state.config.lyricStyle;
      scroll.scrollTop = scroll.scrollLeft = 0;
    }
    scroll.style.setProperty('--vertical-offset', `${state.config.verticalOffset}%`);
    empty.style.setProperty('--size', state.config.fontSize + 'px');
    empty.style.textAlign = state.config.alignment === 'center' ? 'center' : 'left';
    scroll.style.setProperty('--size', `${state.config.fontSize}px`);
    scroll.style.setProperty('--gap', String(state.config.lineGap));
    scroll.style.setProperty('--align', state.config.alignment === 'center' ? 'center' : 'left');
    scroll.style.setProperty('--lyric-color', state.ui.lyricColor || '#fff');
    scroll.style.setProperty('--highlight-color', state.ui.lyricHighlightColor || state.ui.lyricColor || '#fff');
    scroll.style.setProperty('--glow-color', state.ui.lyricGlowColor || '#fff');
    scroll.style.setProperty('--fan-origin', state.config.fanAngle < 0 ? 'right' : 'left');
    const nextKey = JSON.stringify([state.config.fontSize, state.config.lineGap, state.config.alignment, state.config.blur, state.config.scale, state.config.lyricStyle, state.config.fanAngle, state.config.tiltAngle, reducedMotion.matches]);
    if (nextKey !== visualKey) { active = -2; visualKey = nextKey; paintBounds(); }
    status();
  }

  function status() {
    const note = get('.word-timing-note');
    note.hidden = !state.lines.length || hasWordTiming(state.lines) || !(state.config.glow || state.config.float);
    note.textContent = '当前歌词没有逐字时间，暂时只能逐行高亮。逐字辉光和上浮需要切换到逐字歌词，可通过底部搜索查找。';
    empty.hidden = Boolean(rows.length);
    empty.textContent = state.ui.isLoading ? state.ui.loadingText || '正在加载歌词…' : state.ui.emptyMessage || '暂无歌词';
  }

  function tick(time, now) {
    if (browseUntil && now >= browseUntil) restore();
    const next = activeLine(state.lines, time);
    if (next !== active) {
      active = next;
      const currentTime = state.lines[active]?.time;
      rows.forEach(({ node }, index) => {
        const selected = active >= 0 && state.lines[index].time === currentTime;
        const anchor = rows[Math.max(active, 0)]?.node;
        const vertical = state.config.lyricStyle === 'vertical';
        const distance = selected || !anchor ? 0 : lineDistance(
          vertical ? node.offsetLeft - anchor.offsetLeft : node.offsetTop - anchor.offsetTop,
          vertical ? scroll.clientWidth : scroll.clientHeight, vertical ? .5 : .45);
        node.classList.toggle('active', selected);
        node.setAttribute('aria-current', String(selected));
        node.style.setProperty('--blur', `${state.config.blur ? Math.abs(distance) * 5 : 0}px`);
        node.style.setProperty('--scale', String(state.config.scale ? Math.max(.88, 1 - distance * .025) : 1));
        const offset = anchor ? node.offsetTop + node.offsetHeight / 2 - anchor.offsetTop - anchor.offsetHeight / 2 : 0;
        node.style.setProperty('--line-transform', state.config.lyricStyle === 'fan'
          ? fanTransform(offset, scroll.clientHeight, state.config, reducedMotion.matches)
          : lineTransform(distance, state.config, reducedMotion.matches));
      });
      center();
    }
    // Only animate the active rows; a long lyric file does not require per-word updates off screen.
    for (let index = active; index >= 0 && state.lines[index]?.time === state.lines[active]?.time; index--) {
      const line = state.lines[index];
      const nextTime = state.lines.slice(active + 1).find(item => Number.isFinite(item.time) && item.time > line.time)?.time;
      rows[index].words.forEach((span, wordIndex) => {
        const { duration, progress } = wordProgress(line.words, wordIndex, time, nextTime ?? state.track?.duration);
        const elapsed = time - line.words[wordIndex].time;
        const lineEnd = nextTime ?? state.track?.duration ?? line.words[wordIndex].time + duration;
        Array.from(span.children).forEach((char, charIndex, chars) => {
          const effect = wordEffect(elapsed, duration, state.config, reducedMotion.matches, {
            lineElapsed: time - line.time, lineDuration: lineEnd - line.time,
            charElapsed: elapsed - charIndex * duration / chars.length,
          });
          char.style.setProperty('--progress', `${clamp(progress * chars.length - charIndex, 0, 1) * 100}%`);
          char.style.setProperty('--played-opacity', progress * chars.length > charIndex ? '1' : '0');
          char.style.setProperty('--lift', `${effect.lift}px`);
          char.style.setProperty('--word-scale', String(effect.scale));
          char.style.setProperty('--word-glow', `${effect.glow}px`);
          char.style.setProperty('--glow-opacity', effect.glow > 0 ? '1' : '0');
        });
      });
    }
    if (movement) {
      const progress = clamp((now - movement.at) / 500, 0, 1);
      scroll[movement.axis] = movement.from + (movement.to - movement.from) * (1 - (1 - progress) ** 2);
      if (progress === 1) movement = null;
    }
    if (state.config.lyricStyle === 'vertical') {
      const halfGap = state.config.fontSize * state.config.lineGap / 2;
      for (const { node, divider } of rows) {
        divider.style.left = (node.offsetLeft + node.offsetWidth + halfGap) + 'px';
        const scale = reducedMotion.matches || browseUntil ? 1 : new DOMMatrixReadOnly(getComputedStyle(node).transform).a;
        divider.style.height = ((node.offsetHeight + 18) * scale) + 'px';
      }
    }
    if (state.config.lyricStyle === 'fan') {
      const focus = scroll.scrollTop + scroll.clientHeight * .45;
      for (const { node } of rows) {
        const offset = node.offsetTop + node.offsetHeight / 2 - focus;
        node.style.setProperty('--line-transform', fanTransform(offset, scroll.clientHeight, state.config, reducedMotion.matches));
      }
    }
    return Boolean(movement || browseUntil);
  }
  return { render, configure, status, tick, destroy() { observer.disconnect(); movement = null; rows = []; } };
}
