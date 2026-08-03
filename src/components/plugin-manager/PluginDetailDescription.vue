<script setup lang="ts">
defineProps<{
  description: string;
}>();
</script>

<template>
  <section class="plugin-detail-description">
    <h3>简介</h3>
    <p>{{ description }}</p>
  </section>
</template>

<style scoped>
.plugin-detail-description {
  display: grid;
  gap: 8px;
  padding-top: 2px;
}

.plugin-detail-description h3,
.plugin-detail-description p {
  margin: 0;
}

.plugin-detail-description h3 {
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 740;
}

.plugin-detail-description p {
  color: var(--smw-text-secondary);
  font-size: 12px;
  line-height: 1.55;
}
</style>
