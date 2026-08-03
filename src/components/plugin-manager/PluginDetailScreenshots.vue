<script setup lang="ts">
import PluginScreenshotNavButton from './PluginScreenshotNavButton.vue';
import PluginScreenshotDots from './PluginScreenshotDots.vue';

defineProps<{
  activeScreenshot: string;
  activeScreenshotIndex: number;
  screenshots: string[];
}>();

const emit = defineEmits<{
  next: [];
  previous: [];
  select: [index: number];
}>();
</script>

<template>
  <section v-if="screenshots.length > 0" class="plugin-detail-section plugin-screenshot-section">
    <h3>效果图</h3>
    <div class="plugin-screenshot-frame">
      <img :src="activeScreenshot" alt="插件效果图" draggable="false" />
      <template v-if="screenshots.length > 1">
        <PluginScreenshotNavButton direction="previous" label="上一张效果图" @click="emit('previous')" />
        <PluginScreenshotNavButton direction="next" label="下一张效果图" @click="emit('next')" />
      </template>
    </div>
    <PluginScreenshotDots
      v-if="screenshots.length > 1"
      :active-index="activeScreenshotIndex"
      :count="screenshots.length"
      @select="emit('select', $event)"
    />
  </section>
</template>

<style scoped>
.plugin-detail-section {
  display: grid;
  gap: 8px;
  padding-top: 2px;
}

.plugin-detail-section h3 {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 740;
}

.plugin-screenshot-section {
  padding-top: 0;
}

.plugin-screenshot-frame {
  position: relative;
  display: grid;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: var(--smw-bg-panel);
}

.plugin-screenshot-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
}

</style>
