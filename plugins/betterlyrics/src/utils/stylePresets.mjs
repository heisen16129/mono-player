// SPDX-License-Identifier: GPL-3.0-only
export function stylePreset(style) {
  if (style !== 'glow' && style !== 'fan') return {};
  return {
    blur: true, scale: true, glow: true, float: true,
    lineGap: .55, alignment: style === 'glow' ? 'center' : 'left',
    fanAngle: 30, glowScope: 'long', glowAmount: 8, floatAmount: 8,
  };
}

export function hasWordTiming(lines) {
  return lines.some(line => line.words?.some(word => word.text?.trim() && Number.isFinite(word.time)));
}
