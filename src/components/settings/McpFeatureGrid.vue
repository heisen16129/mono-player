<script setup lang="ts">
defineProps<{
  groups: readonly {
    title: string;
    items: readonly string[];
  }[];
}>();
</script>

<template>
  <div class="mcp-feature-grid">
    <article v-for="group in groups" :key="group.title" class="mcp-feature-group">
      <h3>{{ group.title }}</h3>
      <ul>
        <li v-for="item in group.items" :key="item">{{ item }}</li>
      </ul>
    </article>
  </div>
</template>

<style scoped>
.mcp-feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 12px;
}

.mcp-feature-group {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: var(--smw-bg-panel);
}

.mcp-feature-group h3 {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 14px;
  font-weight: 700;
}

.mcp-feature-group ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  color: var(--smw-text-body);
  font-size: 12px;
  line-height: 1.5;
}
</style>
