<script setup lang="ts">
import { t } from '../../i18n';
import type { Locale, PlayerSettings } from '../../types/music';

defineProps<{
  closeAction: PlayerSettings['closeAction'];
  locale: Locale;
}>();

const emit = defineEmits<{
  setCloseAction: [action: PlayerSettings['closeAction']];
}>();
</script>

<template>
  <div class="setting-group">
    <p>{{ t(locale, 'closeAction') }}</p>
    <div class="option-list">
      <label class="option-row">
        <input type="radio" name="close-action" :checked="closeAction === 'exit'" @change="emit('setCloseAction', 'exit')" />
        {{ t(locale, 'exitApp') }}
      </label>
      <label class="option-row">
        <input type="radio" name="close-action" :checked="closeAction === 'tray'" @change="emit('setCloseAction', 'tray')" />
        {{ t(locale, 'minimizeToTray') }}
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

.option-row input[type="radio"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--smw-button-primary);
}
</style>
