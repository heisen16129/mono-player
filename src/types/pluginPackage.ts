export interface PluginPackageManifest {
  schemaVersion: 1;
  apiVersion: 1;
  minHostVersion: string;
  id: string;
  name: string;
  version: string;
  kind: string;
  author: string;
  description: string;
  entry: { wasm?: string | null; renderer?: string | null; service?: string | null };
  capabilities: string[];
  permissions: string[];
  configSchema?: import('./plugin').PluginConfigSchema | null;
  contributions: {
    pages: Array<{ id: string; title: string; entry: string; presentation?: 'page' | 'dialog' | null }>;
    commands: Array<{ id: string; title: string }>;
    sidebar: PluginPackageLauncher[];
    playbackBar: PluginPackageLauncher[];
  };
}
export interface PluginPackageLauncher {
  id: string;
  title: string;
  icon: string;
  pageId?: string | null;
  commandId?: string | null;
}
export interface InstalledPluginPackage extends PluginPackageManifest {
  packageRoot: string;
  packageRevision: string;
  installedAt: string;
  enabled: boolean;
}
export interface InspectedPluginPackage { manifest: PluginPackageManifest; revision: string }
