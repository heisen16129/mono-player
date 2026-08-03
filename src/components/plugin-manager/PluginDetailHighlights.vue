<script setup lang="ts">
defineProps<{
  highlights: string[];
}>();
</script>

<template>
  <section v-if="highlights.length > 0" class="plugin-detail-highlights">
    <h3>亮点</h3>
    <ul class="plugin-highlight-list">
      <li v-for="highlight in highlights" :key="highlight">{{ highlight }}</li>
    </ul>
  </section>
</template>

<style scoped>
.plugin-detail-highlights {
  display: grid;
  gap: 8px;
  padding-top: 2px;
}

.plugin-detail-highlights h3,
.plugin-highlight-list {
  margin: 0;
}

.plugin-detail-highlights h3 {
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 740;
}

.plugin-highlight-list {
  display: grid;
  gap: 7px;
  padding-left: 18px;
  color: var(--smw-text-body);
  font-size: 12px;
  line-height: 1.45;
}
</style>
