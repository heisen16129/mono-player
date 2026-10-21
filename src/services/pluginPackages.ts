import { invoke } from '@tauri-apps/api/core';
import type { InstalledPluginPackage, InspectedPluginPackage } from '../types/pluginPackage';

export function listPluginPackages() {
  return invoke<InstalledPluginPackage[]>('plugin_package_list');
}
export function inspectPluginPackage(path: string) {
  return invoke<InspectedPluginPackage>('plugin_package_inspect', { path });
}
export function installPluginPackage(path: string, revision: string, permissions: string[]) {
  return invoke<InstalledPluginPackage>('plugin_package_install', { path, revision, permissions });
}
export function changePluginPackage(plugin: InstalledPluginPackage, enabled: boolean | null) {
  return invoke<void>('plugin_package_change', { id: plugin.id, revision: plugin.packageRevision, enabled });
}

export const PACKAGE_INSTALL_EVENT = 'mono:install-package';
export interface PackageInstallRequest { path: string; resolve: () => void; reject: (error: Error) => void }
export async function requestPackageInstall(source: string) {
  const path = /^https?:/i.test(source)
    ? await invoke<string>('plugin_package_download', { url: source }) : source;
  await new Promise<void>((resolve, reject) => {
    window.dispatchEvent(new CustomEvent<PackageInstallRequest>(PACKAGE_INSTALL_EVENT, { detail: { path, resolve, reject } }));
  });
}

export function listIncompatiblePluginPackages() {
  return invoke<{id:string;name:string;reason:string}[]>('plugin_package_incompatible');
}
