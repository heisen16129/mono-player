import type { PluginSearchTrack } from './plugin';

export interface OnlineSearchSnapshot {
  activeProviderId: string | null;
  isOpen: boolean;
  query: string;
  results: PluginSearchTrack[];
}
