<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { t } from '../../i18n';
import { listInstalledPlugins, savePluginConfig } from '../../services/plugins';
import { usePlayerStore } from '../../stores/player';
import type { PluginConfig, PluginManifest } from '../../types/plugin';
import PluginConfigFields from './PluginConfigFields.vue';

const player = usePlayerStore();
const locale = computed(() => player.settings.locale);
const installedPlugins = ref<PluginManifest[]>([]);
const pluginConfigs = ref<Record<string, PluginConfig>>({});
const isLoadingPlugins = ref(false);
const configurablePlugins = computed(() => installedPlugins.value.filter((plugin) => configFields(plugin).length > 0));

async function loadPlugins() {
  isLoadingPlugins.value = true;
  try {
    const plugins = await listInstalledPlugins();
    installedPlugins.value = plugins;
    pluginConfigs.value = Object.fromEntries(plugins.map((plugin) => [plugin.id, plugin.config ?? {}]));
  } finally {
    isLoadingPlugins.value = false;
  }
}

function setEnablePlugins(event: Event) {
  player.setEnablePlugins((event.target as HTMLInputElement).checked);
}

function configFields(plugin: PluginManifest) {
  return plugin.configSchema?.fields ?? [];
}

function updatePluginConfig(plugin: PluginManifest, nextConfig: PluginConfig) {
  pluginConfigs.value = { ...pluginConfigs.value, [plugin.id]: nextConfig };
  void savePluginConfig(plugin.id, nextConfig);
}

onMounted(loadPlugins);
</script>

<template>
  <section class="settings-section">
    <h2>{{ t(locale, 'plugins') }}</h2>

    <div class="setting-group">
      <p>插件</p>
      <label class="option-row">
        <input
          type="checkbox"
          :checked="player.settings.enablePlugins"
          @change="setEnablePlugins"
        />
        启用插件
      </label>
      <small>{{ locale === 'en-US' ? 'Plugin pages and online music features are shown after plugins are enabled.' : '启用后才显示发现音乐、下载管理和插件管理菜单。' }}</small>
    </div>
    <div class="setting-group">
      <p>{{ locale === 'en-US' ? 'Plugin Configuration' : '插件配置' }}</p>
      <small v-if="isLoadingPlugins">{{ locale === 'en-US' ? 'Loading plugins...' : '正在读取插件...' }}</small>
      <small v-else-if="configurablePlugins.length === 0">{{ locale === 'en-US' ? 'No installed plugin exposes configurable fields.' : '暂无已安装插件声明配置项。' }}</small>
      <div v-for="plugin in configurablePlugins" :key="plugin.id" class="plugin-config-block">
        <p>{{ plugin.name }}</p>
        <PluginConfigFields
          :config="pluginConfigs[plugin.id] ?? {}"
          :fields="configFields(plugin)"
          :locale="locale"
          :scope-id="plugin.id"
          @update="updatePluginConfig(plugin, $event)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings-section {
  display: grid;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--smw-border);
}

.settings-section h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 720;
}

.setting-group {
  display: grid;
  gap: 8px;
}

.setting-group p,
.setting-group small {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
}

.setting-group small {
  color: var(--smw-text-secondary);
}

.option-row {
  display: inline-flex;
  gap: 9px;
  align-items: center;
  min-height: 20px;
  color: var(--smw-text-body);
  font-size: 14px;
  line-height: 1.2;
}

.option-row input[type="checkbox"],
.option-row input[type="radio"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--smw-button-primary);
}

.plugin-config-block {
  display: grid;
  gap: 10px;
  max-width: 620px;
  padding-top: 4px;
}

.plugin-config-block > p {
  font-weight: 650;
}

</style>
