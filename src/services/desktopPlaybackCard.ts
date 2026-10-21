import { getPluginConfig, savePluginConfig } from './plugins';
export const DESKTOP_CARD_LABEL = 'desktop-playback-card';
let savingStyle: Promise<unknown> = Promise.resolve();
export function saveDesktopCardStyle(cardStyle: string) {
  savingStyle = savingStyle.catch(() => {}).then(async () => {
    const config = await getPluginConfig('playback-card');
    await savePluginConfig('playback-card', { ...config, cardStyle });
  });
  return savingStyle;
}
