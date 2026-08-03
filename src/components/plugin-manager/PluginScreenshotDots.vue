<script setup lang="ts">
defineProps<{
  activeIndex: number;
  count: number;
}>();

const emit = defineEmits<{
  select: [index: number];
}>();
</script>

<template>
  <div class="plugin-screenshot-dots" aria-label="效果图页码">
    <button
      v-for="index in count"
      :key="index"
      type="button"
      :class="{ active: activeIndex === index - 1 }"
      :aria-label="`第 ${index} 张效果图`"
      @click="emit('select', index - 1)"
    ></button>
  </div>
</template>

<style scoped>
.plugin-screenshot-dots {
  display: flex;
  gap: 6px;
  justify-content: center;
  min-height: 16px;
}

.plugin-screenshot-dots button {
  width: 6px;
  height: 6px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--smw-text-secondary) 34%, transparent);
  cursor: pointer;
}

.plugin-screenshot-dots button.active {
  width: 16px;
  background: var(--smw-button-primary);
}
</style>
