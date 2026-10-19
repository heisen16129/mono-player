import { listInstalledPluginManifests, getPluginConfig, savePluginConfig } from './plugins';
import { openDesktopLyricsWindow, DESKTOP_LYRICS_LABEL } from './desktopLyrics';
import { openDesktopPlaybackCard, saveDesktopCardStyle, DESKTOP_CARD_LABEL } from './desktopPlaybackCard';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export async function desktopLyricsPlugins() {
  return listInstalledPluginManifests('desktop-lyrics');
}

export async function closeDesktopLyrics() {
  for (const label of [DESKTOP_LYRICS_LABEL, DESKTOP_CARD_LABEL]) await (await WebviewWindow.getByLabel(label))?.close();
}

export async function isDesktopLyricsVisible() {
  for (const label of [DESKTOP_LYRICS_LABEL, DESKTOP_CARD_LABEL]) {
    const window = await WebviewWindow.getByLabel(label);
    if (window && await window.isVisible()) return true;
  }
  return false;
}

export async function openSelectedDesktopLyrics() {
  const config = await getPluginConfig('desktop-lyrics.host');
  await openDesktopLyricsStyle(String(config.rendererId || 'floating'));
}

export async function selectDesktopLyricsStyle(id: string) {
  const rendererId = id.startsWith('card:') ? 'playback-card' : id;
  if (id.startsWith('card:')) await saveDesktopCardStyle(id.slice(5));
  await savePluginConfig('desktop-lyrics.host', { rendererId });
  for (const label of [DESKTOP_LYRICS_LABEL, DESKTOP_CARD_LABEL]) {
    const existing = await WebviewWindow.getByLabel(label);
    if (existing && await existing.isVisible()) {
      await openDesktopLyricsStyle(rendererId);
      return;
    }
  }
}

export async function openDesktopLyricsStyle(id: string) {
  if (id === 'floating') {
    await (await WebviewWindow.getByLabel(DESKTOP_CARD_LABEL))?.close();
    await openDesktopLyricsWindow();
    return;
  }
  if (id === 'playback-card') {
    await (await WebviewWindow.getByLabel(DESKTOP_LYRICS_LABEL))?.close();
    await openDesktopPlaybackCard('builtin:playback-card');
    return;
  }
  const plugin = (await desktopLyricsPlugins()).find(item => item.id === id);
  if (!plugin) throw new Error('桌面歌词插件已停用或卸载，请重新选择。');
  const manifestPath = plugin.sourceKind === 'local' ? plugin.sourceUrl
    : !/^https?:/i.test(plugin.entry) ? plugin.entry.replace(/[^/\\]+$/, 'manifest.json') : undefined;
  if (!manifestPath) throw new Error('请先安装桌面歌词插件到本地。');
  await (await WebviewWindow.getByLabel(DESKTOP_LYRICS_LABEL))?.close();
  await openDesktopPlaybackCard(plugin.entry, manifestPath, await getPluginConfig(plugin.id), plugin.id);
}
