<script setup lang="ts">
import { t } from '../../i18n';
import type { Locale } from '../../types/music';

defineProps<{
  enableTrackCoverEdit: boolean;
  enableTrackDurationRefresh: boolean;
  enableTrackMetadataEdit: boolean;
  locale: Locale;
  showTrackCovers: boolean;
  showTrackNumbers: boolean;
}>();

const emit = defineEmits<{
  setEnableTrackCoverEdit: [enabled: boolean];
  setEnableTrackDurationRefresh: [enabled: boolean];
  setEnableTrackMetadataEdit: [enabled: boolean];
  setShowTrackCovers: [enabled: boolean];
  setShowTrackNumbers: [enabled: boolean];
}>();

function checked(event: Event) {
  return (event.target as HTMLInputElement).checked;
}
</script>

<template>
  <details class="track-list-settings" open>
    <summary>{{ locale === 'en-US' ? 'Track list' : '歌曲列表' }}</summary>
    <div class="track-list-body">
      <div class="setting-group">
        <p>{{ t(locale, 'songListHiddenColumns') }}</p>
        <div class="option-list">
          <label class="option-row">
            <input type="checkbox" :checked="showTrackNumbers" @change="emit('setShowTrackNumbers', checked($event))" />
            显示序号
          </label>
          <label class="option-row">
            <input type="checkbox" :checked="showTrackCovers" @change="emit('setShowTrackCovers', checked($event))" />
            显示歌曲封面
          </label>
        </div>
      </div>

      <div class="setting-group">
        <p>歌曲列表右键设置</p>
        <div class="option-list track-edit-options">
          <label class="option-row">
            <input type="checkbox" :checked="enableTrackMetadataEdit" @change="emit('setEnableTrackMetadataEdit', checked($event))" />
            更改元数据
          </label>
          <label class="option-row">
            <input type="checkbox" :checked="enableTrackCoverEdit" @change="emit('setEnableTrackCoverEdit', checked($event))" />
            更换封面
          </label>
          <label class="option-row">
            <input type="checkbox" :checked="enableTrackDurationRefresh" @change="emit('setEnableTrackDurationRefresh', checked($event))" />
            重新读取歌曲时长
          </label>
        </div>
      </div>
    </div>
  </details>
</template>

<style scoped>
.track-list-settings {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--smw-border);
  border-radius: 12px;
  background: var(--smw-bg-panel);
}

summary {
  position: relative;
  padding-right: 20px;
  list-style: none;
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

summary::-webkit-details-marker { display: none; }
summary::after { content: '▸'; position: absolute; right: 0; top: 0; }
.track-list-settings[open] > summary::after { content: '▾'; }

.track-list-body {
  display: grid;
  gap: 16px;
  margin-top: 14px;
}

.setting-group .option-list.track-edit-options:has(input[type='checkbox']) {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.setting-group .track-edit-options .option-row:has(input[type='checkbox']) {
  grid-column: auto;
  gap: 4px;
  padding: 8px 6px;
  font-size: 11px;
  white-space: nowrap;
}

.setting-group .track-edit-options .option-row:has(input[type='checkbox']):last-child:nth-child(odd) {
  grid-column: auto;
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

.option-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--smw-button-primary);
}
</style>
