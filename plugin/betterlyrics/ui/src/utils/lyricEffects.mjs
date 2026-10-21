// SPDX-License-Identifier: GPL-3.0-only
import { clamp } from '../state.mjs';

export function lineDistance(offset, viewportSize, focus = .45) {
  return clamp(offset / Math.max(1, viewportSize * (offset < 0 ? focus : 1 - focus)), -1, 1);
}

export function lineTransform(distance, config, reducedMotion = false) {
  if (reducedMotion) return 'none';
  const scale = config.scale ? 1 - Math.min(1, Math.abs(distance)) * .25 : 1;
  if (config.lyricStyle === 'perspective') {
    return `perspective(800px) rotateY(${config.tiltAngle}deg) rotateX(${clamp(distance * 6, -24, 24)}deg) translateZ(${-Math.abs(distance) * 28}px) scale(${scale})`;
  }
  return `scale(${scale})`;
}

export function fanClearance(height, angle) {
  return height * (1 / Math.cos(Math.abs(angle) * Math.PI / 180) - 1);
}

export function fanPosition(offset, viewportHeight, maxAngle) {
  if (!maxAngle) return { x: 0, angle: 0, radius: Infinity };
  // One radius for the entire viewport, including both sides of the focus.
  const radius = Math.max(1, viewportHeight * .55) / Math.sin(Math.abs(maxAngle) * Math.PI / 180);
  const theta = Math.asin(clamp(offset / radius, -1, 1));
  const direction = Math.sign(maxAngle);
  return { x: direction * radius * (Math.cos(theta) - 1), angle: direction * theta * 180 / Math.PI, radius };
}

export function fanTransform(offset, viewportHeight, config, reducedMotion = false) {
  if (reducedMotion) return 'none';
  const { x, angle } = fanPosition(offset, viewportHeight, config.fanAngle);
  const scale = config.scale ? 1 - Math.min(1, Math.abs(offset) / Math.max(1, viewportHeight * .55)) * .25 : 1;
  return `translateX(${x}px) rotate(${angle}deg) scale(${scale})`;
}

const sineOut = value => Math.sin(clamp(value, 0, 1) * Math.PI / 2);

// LyricsAnimator: rise through the syllable, then release over up to 350 ms.
export function wordEffect(elapsed, duration, config, reducedMotion = false, timing = {}) {
  const { lineElapsed = elapsed, lineDuration = duration + .35, charElapsed = elapsed } = timing;
  const available = Math.max(0, lineDuration - (lineElapsed - elapsed));
  let rise = Math.min(duration, available), fall = Math.min(.35, Math.max(0, available - rise));
  if (!fall) { fall = rise / 3; rise *= 2 / 3; }
  const envelope = elapsed < 0 || rise <= 0 ? 0 : elapsed < rise
    ? sineOut(elapsed / rise) : fall > 0 ? 1 - sineOut((elapsed - rise) / fall) : 0;
  const fade = Math.min(.175, lineDuration / 2);
  const lineGlow = fade > 0 ? sineOut(lineElapsed / fade) * (1 - sineOut((lineElapsed - lineDuration + fade) / fade)) : 0;
  // Unplayed characters sink on line entry, then rise to their baseline in 450 ms.
  const sunk = sineOut(Math.max(0, lineElapsed - Math.max(0, charElapsed)) / .65);
  return {
    lift: reducedMotion || !config.float ? 0 : config.floatAmount * sunk * (1 - sineOut(Math.max(0, charElapsed) / .45)),
    scale: reducedMotion || config.lyricStyle === 'fan' || !config.scale || duration < .7 ? 1 : 1 + .15 * envelope,
    glow: !config.glow ? 0 : config.glowAmount * (config.glowScope === 'all' ? lineGlow : duration >= .7 ? envelope : 0),
  };
}
