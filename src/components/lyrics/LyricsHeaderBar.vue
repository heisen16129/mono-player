<script setup lang="ts">
defineProps<{
  album: string;
  artist: string;
  title: string;
}>();
</script>

<template>
  <header class="lyrics-heading">
    <h1>{{ title }}</h1>
    <p>
      {{ artist }}
      <span>-</span>
      {{ album }}
    </p>
  </header>
</template>

<style scoped>
.lyrics-heading {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding-top: 16px;
  text-align: center;
}

.lyrics-heading h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 620;
  line-height: 1.1;
}

.lyrics-heading p {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 14px;
}
</style>
