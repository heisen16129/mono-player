<script setup lang="ts">
import { Settings, Shirt } from '@lucide/vue';
import { t } from '../../i18n';
import type { Locale } from '../../types/music';
import SidebarAccountActionButton from './SidebarAccountActionButton.vue';
import SidebarAccountAvatar from './SidebarAccountAvatar.vue';
import SidebarAccountMeta from './SidebarAccountMeta.vue';

defineProps<{
  activeView: 'library' | 'discover' | 'artists' | 'settings' | 'themes' | 'plugins' | 'downloads';
  collapsed: boolean;
  locale: Locale;
}>();

const emit = defineEmits<{
  openSettings: [];
  openTheme: [];
}>();
</script>

<template>
  <div class="account" :class="{ 'is-collapsed': collapsed }">
    <span class="account-hover-surface" aria-hidden="true"></span>
    <SidebarAccountAvatar class="account-avatar" />
    <SidebarAccountMeta class="account-meta-position" :locale="locale" />
    <div class="account-actions">
      <SidebarAccountActionButton
        :active="activeView === 'settings'"
        :label="t(locale, 'settings')"
        @action="emit('openSettings')"
      >
        <template #icon><Settings :size="18" /></template>
      </SidebarAccountActionButton>
      <SidebarAccountActionButton
        :active="activeView === 'themes'"
        :label="t(locale, 'themes')"
        @action="emit('openTheme')"
      >
        <template #icon><Shirt :size="18" /></template>
      </SidebarAccountActionButton>
    </div>
  </div>
</template>

<style scoped>
.account {
  position: relative;
  display: block;
  height: 50px;
  margin-top: auto;
  padding: 15px 0 0;
}

.account::before {
  position: absolute;
  z-index: 2;
  top: 0;
  left: 6px;
  width: calc(100% - 12px);
  height: 1px;
  background: var(--smw-border);
  content: '';
}

.account.is-collapsed {
  z-index: 40;
  align-self: flex-start;
  width: 58px;
}

.account.is-collapsed::before {
  left: 0;
  width: 58px;
  transition: width 190ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.account.is-collapsed:hover::before {
  width: 226px;
}

.account-hover-surface {
  display: none;
}

.account.is-collapsed .account-hover-surface {
  position: absolute;
  z-index: 0;
  top: 0;
  left: 0;
  display: block;
  width: 58px;
  height: 50px;
  opacity: 0;
  background: var(--smw-bg-sidebar);
  transition:
    width 190ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 120ms ease;
}

.account.is-collapsed:hover .account-hover-surface {
  width: 226px;
  opacity: 1;
}

.account > .account-avatar {
  position: absolute;
  z-index: 1;
  top: 15px;
  left: 12px;
}

.account-actions {
  position: absolute;
  z-index: 1;
  top: 15px;
  right: 6px;
  display: flex;
  gap: 6px;
  transition:
    opacity 150ms ease,
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.account.is-collapsed .account-actions {
  top: 15px;
  right: auto;
  left: 154px;
  gap: 8px;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-8px) scale(0.96);
}

.account.is-collapsed:hover .account-actions {
  opacity: 1;
  pointer-events: auto;
  transition-delay: 45ms;
  transform: translateX(0) scale(1);
}

.account-meta-position {
  position: absolute;
  z-index: 1;
  top: 15px;
  left: 50px;
}

.account.is-collapsed .account-meta-position {
  opacity: 0;
  pointer-events: none;
  transform: translateX(-8px);
}

.account.is-collapsed:hover .account-meta-position {
  opacity: 1;
  transition-delay: 35ms;
  transform: translateX(0);
}
</style>
