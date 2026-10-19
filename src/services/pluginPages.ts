import type { PluginManifest } from '../types/plugin';
import { invokeApi } from './api';

export function hasPluginSidebarPage(plugin: PluginManifest): boolean {
  const request = plugin.sidebar;
  if (!request || !['speaker', 'audio-lines', 'plug'].includes(request.icon)) return false;
  const page = request.page;
  if (!page || typeof page !== 'object') return false;
  if ('url' in page) {
    try { return new URL(page.url).protocol === 'https:'; } catch { return false; }
  }
  return ['speaker-control', 'stem-separation'].includes(page.action) && plugin.capabilities.includes(page.action);
}

export async function resolvePluginPage(plugin: PluginManifest): Promise<string> {
  if (!hasPluginSidebarPage(plugin)) throw new Error('插件未声明有效的页面入口');
  const page = plugin.sidebar!.page;
  if ('url' in page) return page.url;
  if (page.action === 'stem-separation') return '';
  const url = new URL(await invokeApi<string>('miot_open'));
  url.searchParams.set('monoSidebar', '1');
  return url.href;
}
