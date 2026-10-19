import { AudioLines, Speaker } from '@lucide/vue';
import type { Component } from 'vue';
import type { PluginCapability, PluginManifest } from '../../types/plugin';
import MiotLauncher from '../miot/MiotLauncher.vue';
import StemSeparationLauncher from '../stem-separation/StemSeparationLauncher.vue';

interface PluginLauncherDefinition {
  capability: PluginCapability;
  icon: Component;
  component: Component;
}

// Shared by the plugin manager and playback bar. Launchers expose an `open` slot prop.
export const pluginLaunchers: readonly PluginLauncherDefinition[] = [
  { capability: 'speaker-control', icon: Speaker, component: MiotLauncher },
  { capability: 'stem-separation', icon: AudioLines, component: StemSeparationLauncher },
];

export function getPluginLaunchers(plugin: { capabilities: PluginCapability[] }) {
  return pluginLaunchers.filter(launcher => plugin.capabilities.includes(launcher.capability));
}

const playbackBarIcons = { speaker: Speaker, 'audio-lines': AudioLines };

export function getPlaybackBarLaunchers(plugin: PluginManifest) {
  const request = plugin.playbackBar;
  if (!request || !Object.hasOwn(playbackBarIcons, request.icon)) return [];
  return getPluginLaunchers(plugin)
    .filter(launcher => launcher.capability === request.action)
    .map(launcher => ({ ...launcher, icon: playbackBarIcons[request.icon] }));
}
