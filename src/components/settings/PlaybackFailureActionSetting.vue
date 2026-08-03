<script setup lang="ts">
import type { OnlinePlaybackFailureAction } from '../../types/music';

defineProps<{
  onlinePlaybackFailureAction: OnlinePlaybackFailureAction;
  options: readonly { value: OnlinePlaybackFailureAction; label: string }[];
}>();

const emit = defineEmits<{
  setOnlinePlaybackFailureAction: [action: OnlinePlaybackFailureAction];
}>();
</script>

<template>
  <div class="setting-group">
    <p>播放失败后</p>
    <div class="inline-options">
      <label v-for="option in options" :key="option.value" class="option-row">
        <input
          type="radio"
          name="playback-failure-action"
          :checked="onlinePlaybackFailureAction === option.value"
          @change="emit('setOnlinePlaybackFailureAction', option.value)"
        />
        {{ option.label }}
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

.inline-options {
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

.option-row input[type="radio"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--smw-button-primary);
}
</style>
