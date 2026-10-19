<script setup lang="ts">
import SlButton from '../ui/SlButton.vue';
defineProps<{ title: string; subtitle?: string; back?: boolean }>();
defineEmits<{ back: [] }>();

function startHostDrag(event: PointerEvent) {
  if (event.button !== 0 || new URLSearchParams(window.location.search).get('monoSidebar') !== '1') return;
  if (!(event.target instanceof Element) || event.target.closest('button, a, input, select, textarea, [role="button"]')) return;
  event.preventDefault();
  window.parent.postMessage({ type: 'mono:window-drag' }, '*');
}
</script>

<template>
  <header class="miot-appbar" @pointerdown="startHostDrag">
    <SlButton v-if="back" variant="icon" icon="arrow_back" title="返回" @click="$emit('back')" />
    <h1 class="miot-appbar-title">
      {{ title }}
      <span v-if="subtitle" class="miot-appbar-subtitle">{{ subtitle }}</span>
    </h1>
    <div class="appbar-actions"><slot /></div>
  </header>
</template>
