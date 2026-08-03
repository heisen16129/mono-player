<script setup lang="ts">
import { t } from '../i18n';
import type { Locale } from '../types/music';

defineProps<{
  canceling: boolean;
  confirming: boolean;
  locale: Locale;
  progressText?: string;
}>();

const emit = defineEmits<{
  cancel: [];
  confirm: [];
}>();
</script>

<template>
  <footer class="scan-dialog-actions">
    <p v-if="progressText" class="scan-progress">{{ progressText }}</p>
    <button v-if="confirming" class="secondary-button" type="button" :disabled="canceling" @click="emit('cancel')">
      {{ canceling ? t(locale, 'canceling') : t(locale, 'cancel') }}
    </button>
    <button class="confirm-button" type="button" :disabled="confirming" @click="emit('confirm')">
      {{ confirming ? t(locale, 'scanning') : t(locale, 'confirm') }}
    </button>
  </footer>
</template>

<style scoped>
.scan-dialog-actions {
  --button-min-height: 32px;
  --button-padding-x: 16px;
  --button-min-width: 58px;

  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 14px;
  padding: 14px 18px 16px;
  border-top: 1px solid var(--smw-border-soft);
}

.scan-progress {
  min-width: 0;
  margin: 0 auto 0 0;
  overflow: hidden;
  color: var(--smw-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
