<script setup lang="ts">
import PlaybackTransitionOptionRow from './PlaybackTransitionOptionRow.vue';

defineProps<{
  crossfadePlayback: boolean;
  fadePlayback: boolean;
  locale: string;
  seamlessPlayback: boolean;
}>();

const emit = defineEmits<{
  setCrossfadePlayback: [value: boolean];
  setFadePlayback: [value: boolean];
  setSeamlessPlayback: [value: boolean];
}>();
</script>

<template>
  <div class="setting-group">
    <p>{{ locale === 'en-US' ? 'Transitions' : '播放过渡' }}</p>
    <div class="option-list">
      <PlaybackTransitionOptionRow
        :checked="seamlessPlayback"
        :label="locale === 'en-US' ? 'Seamless playback' : '无缝播放'"
        @change="emit('setSeamlessPlayback', $event)"
      />
      <PlaybackTransitionOptionRow
        :checked="fadePlayback"
        :label="locale === 'en-US' ? 'Fade in/out' : '淡入淡出'"
        @change="emit('setFadePlayback', $event)"
      />
      <PlaybackTransitionOptionRow
        :checked="crossfadePlayback"
        :label="locale === 'en-US' ? 'Crossfade between tracks' : '交叉淡化'"
        @change="emit('setCrossfadePlayback', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.setting-group {
  display: grid;
  gap: 8px;
}

.setting-group p {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
}

.option-list {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 44px;
}

</style>
