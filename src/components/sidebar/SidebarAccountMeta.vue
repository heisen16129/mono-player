<script setup lang="ts">
import { t } from '../../i18n';
import type { Locale } from '../../types/music';

defineProps<{
  locale: Locale;
}>();
</script>

<template>
  <span class="account-meta">
    <strong>Mono</strong>
    <small>{{ t(locale, 'online') }}</small>
  </span>
</template>

<style scoped>
.account-meta {
  display: grid;
  gap: 3px;
  min-width: 0;
  max-width: 150px;
  overflow: hidden;
  opacity: 1;
  line-height: 1;
  white-space: nowrap;
  transform: translateX(0);
  transition:
    max-width 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 120ms ease,
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.account-meta strong,
.account-meta small {
  display: flex;
  align-items: center;
  gap: 4px;
}

.account-meta strong {
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 620;
  line-height: 15px;
}

.account-meta small {
  color: var(--smw-text-secondary);
  font-size: 11px;
  font-weight: 450;
  line-height: 13px;
}
</style>
