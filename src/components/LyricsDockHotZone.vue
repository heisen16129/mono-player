<script setup lang="ts">
defineEmits<{
  hover: [];
}>();
</script>

<template>
  <div
    class="lyrics-dock-hot-zone"
    aria-hidden="true"
    @mouseenter="$emit('hover')"
  ></div>
</template>

<style scoped>
.lyrics-dock-hot-zone {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 31;
  height: 28px;
}
</style>
