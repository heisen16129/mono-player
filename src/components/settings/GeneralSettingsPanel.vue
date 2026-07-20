<script setup lang="ts">
import { computed } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { t } from '../../i18n';
import { usePlayerStore } from '../../stores/player';
import type { Locale } from '../../types/music';

const player = usePlayerStore();
const locale = computed(() => player.settings.locale);
const historyOptions = ['5', '10', '15', '20', '25'];

function setLocale(event: Event) {
  player.setLocale((event.target as HTMLSelectElement).value as Locale);
}

function setSearchHistoryLimit(event: Event) {
  player.setSearchHistoryLimit(Number((event.target as HTMLInputElement).value));
}

async function chooseDownloadDir() {
  const selected = await open({
    directory: true,
    multiple: false,
    title: '选择下载目录',
  });

  if (typeof selected === 'string') {
    player.setDownloadDir(selected);
  }
}
</script>

<template>
  <section class="settings-section">
    <h2>{{ t(locale, 'settings') }}</h2>

    <div class="setting-group">
      <p>{{ t(locale, 'closeAction') }}</p>
      <div class="option-list">
        <label class="option-row">
          <input
            type="radio"
            name="close-action"
            :checked="player.settings.closeAction === 'exit'"
            @change="player.setCloseAction('exit')"
          />
          {{ t(locale, 'exitApp') }}
        </label>
        <label class="option-row">
          <input
            type="radio"
            name="close-action"
            :checked="player.settings.closeAction === 'tray'"
            @change="player.setCloseAction('tray')"
          />
          {{ t(locale, 'minimizeToTray') }}
        </label>
      </div>
    </div>

    <div class="setting-group">
      <p>{{ t(locale, 'maxHistory') }}</p>
      <div class="inline-options history-options">
        <label v-for="option in historyOptions" :key="option" class="option-row">
          <input
            type="radio"
            name="search-history-limit"
            :value="option"
            :checked="player.settings.searchHistoryLimit === Number(option)"
            @change="setSearchHistoryLimit"
          />{{ option }}
        </label>
      </div>
    </div>

    <div class="setting-group">
      <p>{{ t(locale, 'songListHiddenColumns') }}</p>
      <div class="option-list">
        <label class="option-row">
          <input
            type="checkbox"
            :checked="player.settings.showTrackNumbers"
            @change="player.setShowTrackNumbers(($event.target as HTMLInputElement).checked)"
          />
          显示序号
        </label>
        <label class="option-row">
          <input
            type="checkbox"
            :checked="player.settings.showTrackCovers"
            @change="player.setShowTrackCovers(($event.target as HTMLInputElement).checked)"
          />
          显示歌曲封面
        </label>
      </div>
    </div>

    <div class="setting-group">
      <p>歌曲列表右键设置</p>
      <div class="option-list">
        <label class="option-row">
          <input
            type="checkbox"
            :checked="player.settings.enableTrackMetadataEdit"
            @change="player.setEnableTrackMetadataEdit(($event.target as HTMLInputElement).checked)"
          />
          更改元数据
        </label>
        <label class="option-row">
          <input
            type="checkbox"
            :checked="player.settings.enableTrackCoverEdit"
            @change="player.setEnableTrackCoverEdit(($event.target as HTMLInputElement).checked)"
          />
          更换封面
        </label>
        <label class="option-row">
          <input
            type="checkbox"
            :checked="player.settings.enableTrackDurationRefresh"
            @change="player.setEnableTrackDurationRefresh(($event.target as HTMLInputElement).checked)"
          />
          重新读取歌曲时长
        </label>
      </div>
    </div>

    <label class="field-row">
      <span>{{ t(locale, 'language') }}</span>
      <select :value="player.settings.locale" @change="setLocale">
        <option value="system">{{ t(locale, 'autoLanguage') }}</option>
        <option value="zh-CN">zh-CN</option>
        <option value="en-US">en-US</option>
      </select>
    </label>

    <label class="field-row wide-field">
      <span>下载位置</span>
      <span class="path-field">
        <input
          type="text"
          :value="player.settings.downloadDir"
          placeholder="请选择音乐下载目录"
          @change="player.setDownloadDir(($event.target as HTMLInputElement).value)"
        />
        <button class="secondary-button compact" type="button" @click="chooseDownloadDir">
          选择
        </button>
      </span>
    </label>
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
.field-row span {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
}

.inline-options,
.option-list {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 44px;
}

.history-options {
  gap: 14px 52px;
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

.field-row {
  display: grid;
  gap: 8px;
  max-width: 280px;
}

.wide-field {
  max-width: 560px;
}

.field-row select {
  height: 36px;
  min-width: 0;
  padding: 0 38px 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background:
    linear-gradient(45deg, transparent 50%, var(--smw-text-secondary) 50%) calc(100% - 17px) 15px / 6px 6px no-repeat,
    linear-gradient(135deg, var(--smw-text-secondary) 50%, transparent 50%) calc(100% - 12px) 15px / 6px 6px no-repeat,
    var(--smw-bg-input);
  cursor: pointer;
  outline: none;
  appearance: none;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease,
    background-color 150ms ease;
}

.field-row select:hover,
.path-field input:hover {
  border-color: var(--smw-text-muted);
}

.field-row select:focus,
.path-field input:focus {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.path-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  gap: 8px;
  align-items: center;
}

.path-field input {
  height: 36px;
  min-width: 0;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  outline: none;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.secondary-button.compact:hover {
  border-color: color-mix(in srgb, var(--smw-button-primary) 34%, var(--smw-border));
  color: var(--smw-button-primary);
  background: color-mix(in srgb, var(--smw-button-primary) 8%, var(--smw-bg-input));
}

.secondary-button.compact:focus-visible {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
  outline: none;
}
</style>
