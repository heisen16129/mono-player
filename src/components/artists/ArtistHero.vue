<script setup lang="ts">
import { UserRound } from '@lucide/vue';

defineProps<{
  title: string;
  trackCountLabel: string;
}>();
</script>

<template>
  <div class="artist-hero">
    <span class="artist-hero-icon"><UserRound :size="34" /></span>
    <div>
      <h2>{{ title }}</h2>
      <p>{{ trackCountLabel }}</p>
    </div>
  </div>
</template>

<style scoped>
.artist-hero {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: 22px;
  align-items: center;
  padding: 18px 8px 26px;
}

.artist-hero-icon {
  display: grid;
  width: 86px;
  height: 86px;
  place-items: center;
  border: 1px solid var(--smw-border);
  border-radius: 50%;
  color: var(--smw-text-primary);
  background: var(--smw-bg-input);
}

.artist-hero h2 {
  margin: 0 0 8px;
  color: var(--smw-text-primary);
  font-size: 30px;
  line-height: 1.15;
}

.artist-hero p {
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 14px;
}
</style>
