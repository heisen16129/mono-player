<script setup lang="ts">
defineProps<{
  capabilities: string[];
  localizedCapability: (capability: string) => string;
}>();
</script>

<template>
  <section class="plugin-detail-capabilities">
    <h3>能力</h3>
    <div class="plugin-capability-list">
      <span v-for="capability in capabilities" :key="capability">{{ localizedCapability(capability) }}</span>
    </div>
  </section>
</template>

<style scoped>
.plugin-detail-capabilities {
  display: grid;
  gap: 8px;
  padding-top: 2px;
}

.plugin-detail-capabilities h3 {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 740;
}

.plugin-capability-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.plugin-capability-list span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 22px;
  padding: 0 7px;
  border-radius: 6px;
  color: var(--smw-text-secondary);
  background: color-mix(in srgb, var(--smw-bg-selected) 50%, transparent);
  font-size: 11px;
  white-space: nowrap;
}
</style>
