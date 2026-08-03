import type { PluginCapability } from '../types/plugin';

interface PluginManagerPresentationOptions {
  notify: (message: string, variant?: 'success' | 'error') => void;
}

export function usePluginManagerPresentation(options: PluginManagerPresentationOptions) {
  function notifyPlugin(message: string) {
    if (!message) return;
    const variant = /失败|错误|不可|请先/.test(message) ? 'error' : 'success';
    options.notify(message, variant);
  }

  function createFormatCapabilities(localizedCapability: (capability: string) => string) {
    return (capabilities: PluginCapability[], installed = true) => {
      if (!installed) return '';
      return capabilities.length > 0 ? capabilities.map(localizedCapability).join(' / ') : '无可用能力';
    };
  }

  return {
    createFormatCapabilities,
    notifyPlugin,
  };
}
