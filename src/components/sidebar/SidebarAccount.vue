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
    <SidebarAccountAvatar class="account-avatar" />
    <SidebarAccountMeta class="account-meta-position" :collapsed="collapsed" :locale="locale" />
    <SidebarAccountActionButton
      class="account-action-button"
      :active="activeView === 'settings'"
      :label="t(locale, 'settings')"
      @action="emit('openSettings')"
    >
      <template #icon><Settings :size="18" /></template>
    </SidebarAccountActionButton>
    <SidebarAccountActionButton
      class="account-action-button"
      :active="activeView === 'themes'"
      :label="t(locale, 'themes')"
      @action="emit('openTheme')"
    >
      <template #icon><Shirt :size="18" /></template>
    </SidebarAccountActionButton>
  </div>
</template>

<style scoped>
.account {
  position: relative;
  display: block;
  height: 48px;
  margin-top: auto;
  padding: 15px 6px 0;
  border-top: 1px solid var(--smw-border);
  transition:
    height 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    padding 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.account.is-collapsed {
  height: 138px;
  width: 100%;
  padding-inline: 12px 0;
}

.account > .account-avatar {
  position: absolute;
  top: 15px;
  left: 12px;
}

.account > .account-action-button {
  position: absolute;
  top: 15px;
  transition:
    top 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    left 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.account > .account-action-button:nth-of-type(1) {
  left: calc(100% - 74px);
}

.account > .account-action-button:nth-of-type(2) {
  left: calc(100% - 34px);
}

.account.is-collapsed > .account-action-button {
  left: 12px;
}

.account.is-collapsed > .account-action-button:nth-of-type(1) {
  top: 60px;
}

.account.is-collapsed > .account-action-button:nth-of-type(2) {
  top: 104px;
}

.account-meta-position {
  position: absolute;
  top: 15px;
  left: 50px;
}
</style>
