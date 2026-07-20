<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import { usePlayerStore } from '../../stores/player';

const player = usePlayerStore();
const locale = computed(() => player.settings.locale);

function setEnablePlugins(event: Event) {
  player.setEnablePlugins((event.target as HTMLInputElement).checked);
}
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
      <small>启用后才显示发现音乐、下载管理和插件管理菜单。</small>
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

.setting-group p {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
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

.option-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--smw-button-primary);
}
</style>
