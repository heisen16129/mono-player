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
    <div class="option-list">
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
</template>

<style scoped>
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
