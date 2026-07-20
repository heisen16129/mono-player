<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { t } from '../../i18n';
import {
  clearRustBackendCache,
  getRustBackendCacheStatus,
  getRustBackendDefaultCacheDir,
  getRustBackendSystemTempCacheDir,
  listRustBackendOutputDevices,
  pruneRustBackendCache,
} from '../../services/playerBackend';
import { usePlayerStore } from '../../stores/player';
import type { PlaybackQualityFallback } from '../../types/music';

const player = usePlayerStore();
const locale = computed(() => player.settings.locale);
const qualityFallbackOptions = [
  { value: 'lower', label: '自动降级' },
  { value: 'higher', label: '自动升级' },
  { value: 'none', label: '不重试' },
] as const satisfies readonly { value: PlaybackQualityFallback; label: string }[];
const playbackFailureOptions = [
  { value: 'pause', label: '暂停播放' },
  { value: 'next', label: '自动播放下一首' },
] as const;
const outputDevices = ref<{ id: string; name: string; isDefault: boolean }[]>([]);
const cacheCleanupMessage = ref('');
const cacheStatus = ref({ files: 0, bytes: 0 });
const cacheUsedLabel = computed(() => `${(cacheStatus.value.bytes / 1024 / 1024).toFixed(1)} MB`);

function setSleepTimerMinutes(event: Event) {
  player.setSleepTimerMinutes(Number((event.target as HTMLInputElement).value));
}

function setAudioCacheMaxMb(event: Event) {
  player.setAudioCacheMaxMb(Number((event.target as HTMLInputElement).value));
  void refreshCacheStatus();
}

async function chooseAudioCacheDir() {
  const selected = await open({
    directory: true,
    multiple: false,
    title: '选择音频临时缓存目录',
  });

  if (typeof selected === 'string') {
    player.setAudioCacheDir(selected);
  }
}

async function useSystemTempCacheDir() {
  const cacheDir = await getRustBackendSystemTempCacheDir();
  player.setAudioCacheDir(cacheDir);
}

async function useDefaultCacheDir() {
  const cacheDir = await getRustBackendDefaultCacheDir();
  player.setAudioCacheDir(cacheDir);
}

async function clearAudioCache() {
  const result = await clearRustBackendCache();
  await refreshCacheStatus();
  cacheCleanupMessage.value = `已清理 ${result.removedFiles} 个文件，释放 ${(result.removedBytes / 1024 / 1024).toFixed(1)} MB`;
}

async function pruneAudioCache() {
  const result = await pruneRustBackendCache(player.settings.audioCacheMaxMb * 1024 * 1024);
  cacheCleanupMessage.value = `已按上限清理 ${result.removedFiles} 个文件，当前约 ${(result.remainingBytes / 1024 / 1024).toFixed(1)} MB`;
}

async function refreshOutputDevices() {
  outputDevices.value = await listRustBackendOutputDevices();
}

async function refreshCacheStatus() {
  cacheStatus.value = await getRustBackendCacheStatus();
}

function setAudioOutputDevice(event: Event) {
  player.setAudioOutputDeviceId((event.target as HTMLSelectElement).value);
}

onMounted(() => {
  void refreshOutputDevices();
  void refreshCacheStatus();
});
</script>

<template>
  <section class="settings-section">
    <h2>{{ t(locale, 'playback') }}</h2>

    <div class="setting-group">
      <p>{{ locale === 'en-US' ? 'Transitions' : '播放过渡' }}</p>
      <div class="option-list">
        <label class="option-row">
          <input
            type="checkbox"
            :checked="player.settings.seamlessPlayback"
            @change="player.setSeamlessPlayback(($event.target as HTMLInputElement).checked)"
          />
          {{ locale === 'en-US' ? 'Seamless playback' : '无缝播放' }}
        </label>
        <label class="option-row">
          <input
            type="checkbox"
            :checked="player.settings.fadePlayback"
            @change="player.setFadePlayback(($event.target as HTMLInputElement).checked)"
          />
          {{ locale === 'en-US' ? 'Fade in/out' : '淡入淡出' }}
        </label>
        <label class="option-row">
          <input
            type="checkbox"
            :checked="player.settings.crossfadePlayback"
            @change="player.setCrossfadePlayback(($event.target as HTMLInputElement).checked)"
          />
          {{ locale === 'en-US' ? 'Crossfade between tracks' : '交叉淡化' }}
        </label>
      </div>
    </div>

    <label class="field-row wide-field">
      <span>{{ locale === 'en-US' ? 'Temp cache' : '临时缓存目录' }}</span>
      <span class="path-field">
        <input
          type="text"
          :value="player.settings.audioCacheDir"
          :placeholder="locale === 'en-US' ? 'App cache directory' : '应用缓存目录'"
          @change="player.setAudioCacheDir(($event.target as HTMLInputElement).value)"
        />
        <button class="secondary-button compact" type="button" @click="useSystemTempCacheDir">
          {{ locale === 'en-US' ? 'System temp' : '系统临时目录' }}
        </button>
        <button class="secondary-button compact" type="button" @click="useDefaultCacheDir">
          {{ locale === 'en-US' ? 'Default' : '默认目录' }}
        </button>
        <button class="secondary-button compact" type="button" @click="chooseAudioCacheDir">
          {{ locale === 'en-US' ? 'Choose' : '选择' }}
        </button>
      </span>
    </label>

    <div class="setting-group">
      <p>{{ locale === 'en-US' ? 'Cache management' : '缓存管理' }}</p>
      <div class="cache-management-row">
        <label class="cache-size-field">
          <span>{{ locale === 'en-US' ? 'Max MB' : '最大 MB' }}</span>
          <input
            type="number"
            min="64"
            max="51200"
            step="64"
            :value="player.settings.audioCacheMaxMb"
            @change="setAudioCacheMaxMb"
          />
        </label>
        <span class="cache-actions">
          <button v-if="false" class="secondary-button compact" type="button" @click="pruneAudioCache">
            {{ locale === 'en-US' ? 'Apply limit' : '应用上限' }}
          </button>
          <button class="secondary-button compact" type="button" @click="clearAudioCache">
            {{ locale === 'en-US' ? 'Clear cache' : '清理缓存' }}
          </button>
        </span>
      </div>
      <small class="cache-cleanup-message">
        {{ locale === 'en-US' ? 'Used' : '已用' }} {{ cacheUsedLabel }} / {{ player.settings.audioCacheMaxMb }} MB
        <template v-if="cacheCleanupMessage"> 路 {{ cacheCleanupMessage }}</template>
      </small>
    </div>

    <label class="field-row wide-field">
      <span>{{ locale === 'en-US' ? 'Output device' : '输出设备' }}</span>
      <span class="path-field">
        <select :value="player.settings.audioOutputDeviceId" @change="setAudioOutputDevice">
          <option value="">{{ locale === 'en-US' ? 'System default' : '系统默认' }}</option>
          <option v-for="device in outputDevices" :key="device.id" :value="device.id">
            {{ device.name }}{{ device.isDefault ? (locale === 'en-US' ? ' (default)' : '（默认）') : '' }}
          </option>
        </select>
        <button class="secondary-button compact" type="button" @click="refreshOutputDevices">
          {{ locale === 'en-US' ? 'Refresh' : '刷新' }}
        </button>
      </span>
    </label>

    <label class="field-row">
      <span>定时关闭默认时间</span>
      <span class="number-field">
        <input
          type="number"
          min="1"
          max="999"
          step="1"
          :value="player.settings.sleepTimerMinutes"
          aria-label="定时关闭默认分钟数"
          @change="setSleepTimerMinutes"
        />
        <small>分钟</small>
      </span>
    </label>

    <div class="setting-group">
      <p>定时关闭后</p>
      <div class="inline-options">
        <label class="option-row">
          <input
            type="radio"
            name="sleep-timer-action"
            :checked="player.settings.sleepTimerAction === 'stop'"
            @change="player.setSleepTimerAction('stop')"
          />
          停止播放
        </label>
        <label class="option-row">
          <input
            type="radio"
            name="sleep-timer-action"
            :checked="player.settings.sleepTimerAction === 'exit'"
            @change="player.setSleepTimerAction('exit')"
          />
          退出程序
        </label>
      </div>
    </div>

    <div class="setting-group">
      <p>{{ t(locale, 'qualityFallback') }}</p>
      <div class="inline-options">
        <label v-for="option in qualityFallbackOptions" :key="option.value" class="option-row">
          <input
            type="radio"
            name="quality-fallback"
            :checked="player.settings.qualityFallback === option.value"
            @change="player.setQualityFallback(option.value)"
          />
          {{ option.label }}
        </label>
      </div>
    </div>

    <div class="setting-group">
      <p>播放失败后</p>
      <div class="inline-options">
        <label v-for="option in playbackFailureOptions" :key="option.value" class="option-row">
          <input
            type="radio"
            name="playback-failure-action"
            :checked="player.settings.onlinePlaybackFailureAction === option.value"
            @change="player.setOnlinePlaybackFailureAction(option.value)"
          />
          {{ option.label }}
        </label>
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

.field-row select,
.path-field select {
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
.path-field select:hover,
.number-field input:hover,
.path-field input:hover,
.cache-size-field input:hover {
  border-color: var(--smw-text-muted);
}

.field-row select:focus,
.path-field select:focus,
.number-field input:focus,
.path-field input:focus,
.cache-size-field input:focus {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.number-field {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}

.number-field input,
.path-field input,
.cache-size-field input {
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

.number-field small {
  color: var(--smw-text-secondary);
  font-size: 13px;
}

.path-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  gap: 8px;
  align-items: center;
}

.cache-management-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  align-items: end;
}

.cache-size-field {
  display: grid;
  grid-template-columns: auto 132px;
  gap: 8px;
  align-items: center;
  color: var(--smw-text-body);
  font-size: 13px;
}

.cache-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.cache-cleanup-message {
  color: var(--smw-text-secondary);
  font-size: 12px;
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
