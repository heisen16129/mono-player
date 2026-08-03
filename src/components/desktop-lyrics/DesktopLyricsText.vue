<script setup lang="ts">
defineProps<{
  lyric: string;
}>();
</script>

<template>
  <div class="desktop-lyrics-text">
    <strong>{{ lyric }}</strong>
  </div>
</template>

<style scoped>
.desktop-lyrics-text {
  display: grid;
  width: min(100%, 900px);
  padding: 0 20px;
  border: 0;
  background: transparent;
  box-shadow: none;
  text-align: center;
}

.desktop-lyrics-text strong {
  overflow: hidden;
  font-size: clamp(18px, 4vh, 24px);
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  text-shadow:
    0 1px 0 rgba(255, 255, 255, 0.5),
    0 2px 8px rgba(0, 0, 0, 0.26);
  white-space: nowrap;
}
</style>
