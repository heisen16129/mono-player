// SPDX-License-Identifier: GPL-3.0-only
import { configWithDefaults } from '../state.mjs';

export const fanSettingKeys = ['fontSize', 'fanAngle', 'lineGap', 'blur', 'scale', 'showCover'];

export function rendererConfig(config, fanOnly = false) {
  const result = configWithDefaults(config);
  if (fanOnly) Object.assign(result, { lyricStyle: 'fan', alignment: 'left', backgroundMode: 'fluid', glow: false, float: false });
  else if (result.lyricStyle === 'fan') result.lyricStyle = 'standard';
  return result;
}
