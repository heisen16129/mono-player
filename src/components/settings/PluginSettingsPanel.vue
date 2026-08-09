<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { t } from '../../i18n';
import { listInstalledPlugins, savePluginConfig } from '../../services/plugins';
import { usePlayerStore } from '../../stores/player';
import type { PluginConfig, PluginConfigField, PluginManifest } from '../../types/plugin';

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

function defaultFieldValue(field: PluginConfigField) {
  if (field.defaultValue !== undefined && field.defaultValue !== null) return field.defaultValue;
  if (field.type === 'checkbox') return [];
  if (field.type === 'switch') return false;
  return '';
}

function fieldValue(plugin: PluginManifest, field: PluginConfigField) {
  return pluginConfigs.value[plugin.id]?.[field.key] ?? defaultFieldValue(field);
}

function textFieldValue(plugin: PluginManifest, field: PluginConfigField) {
  const value = fieldValue(plugin, field);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function booleanFieldValue(plugin: PluginManifest, field: PluginConfigField) {
  return fieldValue(plugin, field) === true;
}

function checkboxFieldValue(plugin: PluginManifest, field: PluginConfigField) {
  const value = fieldValue(plugin, field);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function setPluginConfigValue(plugin: PluginManifest, field: PluginConfigField, value: PluginConfig[string]) {
  const nextConfig = { ...(pluginConfigs.value[plugin.id] ?? {}) };
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
    delete nextConfig[field.key];
  } else {
    nextConfig[field.key] = value;
  }
  pluginConfigs.value = { ...pluginConfigs.value, [plugin.id]: nextConfig };
  void savePluginConfig(plugin.id, nextConfig);
}

function setTextField(plugin: PluginManifest, field: PluginConfigField, event: Event) {
  setPluginConfigValue(plugin, field, (event.target as HTMLInputElement | HTMLSelectElement).value.trim());
}

function setNumberField(plugin: PluginManifest, field: PluginConfigField, event: Event) {
  const value = (event.target as HTMLInputElement).value.trim();
  const numberValue = Number(value);
  setPluginConfigValue(plugin, field, value && Number.isFinite(numberValue) ? numberValue : undefined);
}

function setSwitchField(plugin: PluginManifest, field: PluginConfigField, event: Event) {
  setPluginConfigValue(plugin, field, (event.target as HTMLInputElement).checked);
}

function setCheckboxField(plugin: PluginManifest, field: PluginConfigField, optionValue: string, event: Event) {
  const selectedValues = new Set(checkboxFieldValue(plugin, field));
  if ((event.target as HTMLInputElement).checked) {
    selectedValues.add(optionValue);
  } else {
    selectedValues.delete(optionValue);
  }
  setPluginConfigValue(plugin, field, [...selectedValues]);
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
        <div v-for="field in configFields(plugin)" :key="field.key" class="plugin-field-row">
          <span>{{ field.label }}</span>

          <input
            v-if="field.type === 'text' || field.type === 'password'"
            :type="field.type"
            autocomplete="off"
            :value="textFieldValue(plugin, field)"
            :placeholder="field.placeholder ?? ''"
            @change="setTextField(plugin, field, $event)"
          />

          <input
            v-else-if="field.type === 'number'"
            type="number"
            :value="textFieldValue(plugin, field)"
            :placeholder="field.placeholder ?? ''"
            @change="setNumberField(plugin, field, $event)"
          />

          <select
            v-else-if="field.type === 'select'"
            :value="textFieldValue(plugin, field)"
            @change="setTextField(plugin, field, $event)"
          >
            <option value="">{{ field.placeholder ?? (locale === 'en-US' ? 'Select' : '请选择') }}</option>
            <option v-for="option in field.options ?? []" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>

          <div v-else-if="field.type === 'radio'" class="inline-options compact-options">
            <label v-for="option in field.options ?? []" :key="option.value" class="option-row">
              <input
                type="radio"
                :name="`${plugin.id}-${field.key}`"
                :value="option.value"
                :checked="textFieldValue(plugin, field) === option.value"
                @change="setTextField(plugin, field, $event)"
              />{{ option.label }}
            </label>
          </div>

          <div v-else-if="field.type === 'checkbox'" class="inline-options compact-options">
            <label v-for="option in field.options ?? []" :key="option.value" class="option-row">
              <input
                type="checkbox"
                :value="option.value"
                :checked="checkboxFieldValue(plugin, field).includes(option.value)"
                @change="setCheckboxField(plugin, field, option.value, $event)"
              />{{ option.label }}
            </label>
          </div>

          <label v-else-if="field.type === 'switch'" class="option-row">
            <input
              type="checkbox"
              :checked="booleanFieldValue(plugin, field)"
              @change="setSwitchField(plugin, field, $event)"
            />{{ locale === 'en-US' ? 'Enabled' : '启用' }}
          </label>
        </div>
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

.plugin-field-row {
  display: grid;
  grid-template-columns: minmax(120px, 180px) minmax(0, 320px);
  gap: 10px;
  align-items: center;
  max-width: 560px;
  color: var(--smw-text-body);
  font-size: 13px;
}

.plugin-field-row > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-field-row input[type="text"],
.plugin-field-row input[type="password"],
.plugin-field-row input[type="number"],
.plugin-field-row select {
  height: 34px;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  outline: none;
}

.plugin-field-row input[type="text"]:focus,
.plugin-field-row input[type="password"]:focus,
.plugin-field-row input[type="number"]:focus,
.plugin-field-row select:focus {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.inline-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
}

.compact-options {
  min-width: 0;
}

@media (max-width: 720px) {
  .plugin-field-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
