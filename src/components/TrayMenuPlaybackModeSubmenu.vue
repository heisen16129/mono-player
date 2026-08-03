<script setup lang="ts">
import { ChevronRight } from '@lucide/vue';

const emit = defineEmits<{
  action: [action: 'mode-shuffle' | 'mode-repeat' | 'mode-fixed'];
}>();
</script>

<template>
  <div class="tray-menu-mode">
    <button type="button">
      <span>播放模式</span>
      <ChevronRight :size="15" />
    </button>
    <div class="tray-menu-submenu">
      <button type="button" @click="emit('action', 'mode-shuffle')">随机播放</button>
      <button type="button" @click="emit('action', 'mode-repeat')">循环播放</button>
      <button type="button" @click="emit('action', 'mode-fixed')">固定播放</button>
    </div>
  </div>
</template>

<style scoped>
.tray-menu-mode {
  position: relative;
}

.tray-menu-mode > button,
.tray-menu-submenu button {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  color: var(--smw-text-body);
  background: transparent;
  font: inherit;
  font-size: 13px;
  line-height: 1;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}

.tray-menu-mode:hover > button,
.tray-menu-submenu button:hover {
  background: var(--smw-bg-hover);
}

.tray-menu-mode > button {
  justify-content: space-between;
  width: 100%;
}

.tray-menu-submenu {
  position: absolute;
  right: calc(100% + 6px);
  bottom: 0;
  display: none;
  width: 116px;
  padding: 6px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--smw-bg-workspace) 97%, transparent);
  box-shadow: 0 12px 30px rgb(0 0 0 / 16%);
}

.tray-menu-mode:hover .tray-menu-submenu {
  display: grid;
}

.tray-menu-submenu button {
  justify-content: flex-start;
  padding: 0 9px;
  white-space: nowrap;
}
</style>
