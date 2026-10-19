import { emitTo } from '@tauri-apps/api/event';
import { currentMonitor, primaryMonitor, PhysicalPosition } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { isTauriRuntime } from './music';
import type { DesktopLyricsState } from './desktopLyrics';
import type { PluginConfig } from '../types/plugin';
import { getPluginConfig, savePluginConfig } from './plugins';

export const DESKTOP_CARD_LABEL = 'desktop-playback-card';
export const DESKTOP_CARD_UPDATE = 'desktop-card://update';
export const DESKTOP_CARD_CONFIG = 'desktop-card://config';
let cardWindow: WebviewWindow | null = null;
let cardRendererId = 'playback-card';
let cardManifestPath: string | undefined;
let opening: Promise<void> | null = null;
const cardConfigId = 'lyrics-renderer.playback-card';
let savingStyle: Promise<unknown> = Promise.resolve();

export function saveDesktopCardStyle(cardStyle: string) {
  savingStyle = savingStyle.catch(() => {}).then(async () => {
    const config = await getPluginConfig(cardConfigId);
    await savePluginConfig(cardConfigId, { ...config, cardStyle });
    if (cardWindow && cardRendererId === 'playback-card') {
      await emitTo(DESKTOP_CARD_LABEL, DESKTOP_CARD_CONFIG, { cardStyle });
    }
  });
  return savingStyle;
}

export async function openDesktopPlaybackCard(entry: string, manifestPath?: string, config: PluginConfig = {}, rendererId = 'playback-card') {
  if (!isTauriRuntime()) throw new Error('请在 Mono 桌面应用中打开播放卡片。');
  if (!manifestPath && entry !== 'builtin:playback-card') throw new Error('请先安装本地播放卡片插件。');
  if (opening) return opening;
  opening = (async () => {
    let existing = await WebviewWindow.getByLabel(DESKTOP_CARD_LABEL);
    if (existing && cardRendererId !== rendererId) { await existing.close(); existing = null; }
    cardRendererId = rendererId;
    if (existing) {
      if (!cardWindow) {
        cardWindow = existing;
        void existing.once('tauri://destroyed', () => { if (cardWindow === existing) cardWindow = null; });
      }
      cardManifestPath = manifestPath;
      if (!await existing.isVisible()) await existing.show();
      return;
    }
    await savingStyle;
    config = { ...config, ...await getPluginConfig(rendererId === 'playback-card' ? cardConfigId : rendererId) };
    const monitor = await currentMonitor() ?? await primaryMonitor();
    const width = 316, height = 483;
    const area = monitor?.workArea;
    const scale = monitor?.scaleFactor ?? 1;
    const position = area ? {
      x: (area.position.x + Math.max(0, area.size.width - (width + 20) * scale)) / scale,
      y: (area.position.y + Math.max(0, area.size.height - (height + 20) * scale)) / scale,
    } : {};
    const query = new URLSearchParams({ desktopCard: '', entry, manifestPath: manifestPath || '', rendererId, cardStyle: String(config.cardStyle || 'minimal') });
    const card = new WebviewWindow(DESKTOP_CARD_LABEL, {
      url: `/?${query}`, title: 'Mono 播放卡片', width, height, ...position,
      decorations: false, transparent: true, backgroundColor: '#00000000',
      resizable: false, alwaysOnTop: true, skipTaskbar: true, shadow: false, focus: false, visible: false,
    });
    cardWindow = card;
    cardManifestPath = manifestPath;
    void card.once('tauri://destroyed', () => { if (cardWindow === card) cardWindow = null; });
    await new Promise<void>((resolve, reject) => {
      void card.once('tauri://created', () => resolve());
      void card.once('tauri://error', event => {
        cardWindow = null;
        reject(new Error(String(event.payload)));
      });
    });
    if (area) {
      const size = await card.outerSize();
      await card.setPosition(new PhysicalPosition(
        area.position.x + Math.max(0, area.size.width - size.width - 20 * scale),
        area.position.y + Math.max(0, area.size.height - size.height - 20 * scale),
      ));
    }
    await card.show();
  })();
  try { await opening; } finally { opening = null; }
}

export async function broadcastDesktopCardState(state: DesktopLyricsState) {
  if (cardWindow) await emitTo(DESKTOP_CARD_LABEL, DESKTOP_CARD_UPDATE, state);
}

export async function syncDesktopCardConfig(manifestPath: string | undefined, config: PluginConfig) {
  if (cardWindow && manifestPath === cardManifestPath) {
    await emitTo(DESKTOP_CARD_LABEL, DESKTOP_CARD_CONFIG, { cardStyle: config.cardStyle ?? 'minimal' });
  }
}
