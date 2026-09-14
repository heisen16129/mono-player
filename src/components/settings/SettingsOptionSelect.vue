<script setup lang="ts">
import { onBeforeUnmount, ref, useId } from 'vue';
import { Check } from '@lucide/vue';

const props = defineProps<{
  options: { id: string; name: string; isDefault?: boolean }[];
  label: string;
  locale: string;
  value: string;
}>();
const emit = defineEmits<{ change: [value: string] }>();
const trigger = ref<HTMLButtonElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const opened = ref(false);
const menuId = useId();


function close() {
  menu.value?.hidePopover();
}

function open() {
  if (opened.value) { close(); return; }
  const rect = trigger.value!.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - 12;
  const above = rect.top - 12;
  const height = Math.min(240, Math.max(below, above));
  Object.assign(menu.value!.style, {
    left: `${rect.left}px`, width: `${rect.width}px`, maxHeight: `${height}px`,
    top: below >= Math.min(240, above) ? `${rect.bottom + 6}px` : 'auto',
    bottom: below >= Math.min(240, above) ? 'auto' : `${window.innerHeight - rect.top + 6}px`,
  });
  menu.value!.showPopover();
  const index = Math.max(0, props.options.findIndex(option => option.id === props.value));
  menu.value!.querySelectorAll<HTMLButtonElement>('button')[index]?.focus({ preventScroll: true });
}

function select(value: string) {
  emit('change', value);
  close();
  trigger.value?.focus({ preventScroll: true });
}

function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    close();
    trigger.value?.focus({ preventScroll: true });
    return;
  }
  const buttons = [...menu.value!.querySelectorAll<HTMLButtonElement>('button')];
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  let next = index;
  if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
  else if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = buttons.length - 1;
  else return;
  event.preventDefault();
  buttons[next]?.focus();
}

function onToggle(event: Event) {
  opened.value = (event as ToggleEvent).newState === 'open';
}

onBeforeUnmount(close);
</script>

<template>
  <button ref="trigger" class="device-trigger" type="button" :aria-label="label" aria-haspopup="menu" :aria-expanded="opened" :aria-controls="menuId" @click="open" @keydown.down.prevent="open">
    <slot />
  </button>
  <div :id="menuId" ref="menu" class="device-menu" popover="auto" role="menu" :aria-label="label" @toggle="onToggle" @keydown="keydown" @pointerdown.stop>
    <button v-for="option in options" :key="option.id" class="device-option" :class="{ selected: value === option.id }" type="button" role="menuitemradio" :aria-checked="value === option.id" @click="select(option.id)">
      <span>{{ option.name }}<small v-if="option.isDefault">{{ locale === 'en-US' ? 'Default' : '默认设备' }}</small></span>
      <Check v-if="value === option.id" :size="14" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.device-trigger {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.device-menu {
  position: fixed;
  box-sizing: border-box;
  margin: 0;
  padding: 5px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--smw-border);
  border-radius: 10px;
  background: var(--smw-bg-workspace);
  color: var(--smw-text-body);
  box-shadow: 0 10px 30px rgb(0 0 0 / 16%);
}
.device-option {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 14px;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 36px;
  padding: 9px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--smw-text-body);
  font: inherit;
  font-size: 12px;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.device-option + .device-option { margin-top: 3px; }
.device-option:hover, .device-option:focus-visible { background: var(--smw-bg-hover); }
.device-option.selected { background: var(--smw-bg-selected); color: var(--smw-text-primary); }
.device-option small { display: block; margin-top: 3px; font-size: 10px; color: var(--smw-text-secondary); }
</style>
