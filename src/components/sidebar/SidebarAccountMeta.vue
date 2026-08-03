<script setup lang="ts">
import { t } from '../../i18n';
import type { Locale } from '../../types/music';

defineProps<{
  collapsed: boolean;
  locale: Locale;
}>();
</script>

<template>
  <span class="account-meta" :class="{ 'is-collapsed': collapsed }">
    <strong>Mono</strong>
    <small>{{ t(locale, 'online') }}</small>
  </span>
</template>

<style scoped>
.account-meta {
  display: grid;
  gap: 2px;
  min-width: 0;
  max-width: 150px;
  overflow: hidden;
  opacity: 1;
  line-height: 1.15;
  white-space: nowrap;
  transform: translateX(0);
  transition:
    max-width 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 120ms ease,
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.account-meta.is-collapsed {
  display: none;
}

.account-meta strong,
.account-meta small {
  display: block;
}

.account-meta strong {
  font-size: 13px;
  font-weight: 560;
}

.account-meta small {
  color: var(--smw-text-secondary);
  font-size: 12px;
}
</style>
