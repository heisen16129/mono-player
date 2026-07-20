<script setup lang="ts">
import { Settings, Shirt, UserRound } from '@lucide/vue';
import { t } from '../../i18n';
import type { Locale } from '../../types/music';

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
    <span class="avatar" aria-hidden="true">
      <UserRound :size="20" />
      <i></i>
    </span>
    <span class="account-meta sidebar-text">
      <strong>Mono</strong>
      <small>{{ t(locale, 'online') }}</small>
    </span>
    <button
      class="icon-button"
      :class="{ 'is-active': activeView === 'settings' }"
      type="button"
      :aria-label="t(locale, 'settings')"
      :title="t(locale, 'settings')"
      @click="emit('openSettings')"
    >
      <Settings :size="18" />
    </button>
    <button
      class="icon-button"
      type="button"
      :class="{ 'is-active': activeView === 'themes' }"
      :aria-label="t(locale, 'themes')"
      :title="t(locale, 'themes')"
      @click="emit('openTheme')"
    >
      <Shirt :size="18" />
    </button>
  </div>
</template>

<style scoped>
.account {
  position: relative;
  display: block;
  height: 52px;
  margin-top: auto;
  padding: 18px 6px 0;
  border-top: 1px solid var(--smw-border);
  transition:
    height 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    padding 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.account.is-collapsed {
  height: 142px;
  width: 100%;
  padding-inline: 12px 0;
}

.avatar {
  position: relative;
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  color: var(--smw-avatar-fg);
  background: linear-gradient(145deg, var(--smw-avatar-bg), var(--smw-avatar-bg-deep));
  box-shadow: inset 0 0 0 1px var(--smw-avatar-border);
  transform: translateZ(0);
}

.account > .avatar {
  position: absolute;
  top: 18px;
  left: 12px;
}

.account > .avatar svg {
  display: block;
  width: 20px;
  height: 20px;
  transform: translateZ(0);
}

.account > .icon-button {
  position: absolute;
  top: 18px;
  transition:
    top 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    left 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.account > .icon-button:nth-of-type(1) {
  left: calc(100% - 74px);
}

.account > .icon-button:nth-of-type(2) {
  left: calc(100% - 34px);
}

.account.is-collapsed > .icon-button {
  left: 12px;
}

.account.is-collapsed > .icon-button:nth-of-type(1) {
  top: 62px;
}

.account.is-collapsed > .icon-button:nth-of-type(2) {
  top: 106px;
}

.icon-button.is-active {
  background: var(--smw-bg-selected);
}

.sidebar-text {
  min-width: 0;
  max-width: 150px;
  overflow: hidden;
  opacity: 1;
  white-space: nowrap;
  transform: translateX(0);
  transition:
    max-width 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 120ms ease,
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.account.is-collapsed .sidebar-text {
  display: none;
}

.account strong,
.account small {
  display: block;
}

.account-meta {
  position: absolute;
  top: 18px;
  left: 50px;
  display: grid;
  gap: 2px;
  line-height: 1.15;
}

.account strong {
  font-size: 13px;
  font-weight: 560;
}

.account small {
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.avatar i {
  position: absolute;
  right: -2px;
  bottom: 0;
  width: 13px;
  height: 13px;
  border: 2px solid var(--smw-avatar-status-border);
  border-radius: 50%;
  background: var(--smw-status-green);
}
</style>
