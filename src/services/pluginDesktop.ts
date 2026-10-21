import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { InstalledPluginPackage } from '../types/pluginPackage';

export async function openPluginDesktop(plugin: InstalledPluginPackage, pageId: string) {
  const label = `plugin-desktop-${plugin.id}`;
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) { await existing.show(); await existing.setFocus(); return; }
  const renderer = Boolean(plugin.entry.renderer);
  const query = new URLSearchParams({ pluginDesktop: plugin.id, pageId });
  const window = new WebviewWindow(label, {
    url: `/?${query}`, title: plugin.name, width: renderer ? 340 : 960, height: renderer ? 500 : 700,
    decorations: false, transparent: renderer, alwaysOnTop: renderer, skipTaskbar: renderer,
  });
  await new Promise<void>((resolve, reject) => {
    void window.once('tauri://created', () => resolve());
    void window.once('tauri://error', event => reject(new Error(String(event.payload))));
  });
}
