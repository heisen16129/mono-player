<script setup lang="ts">
withDefaults(defineProps<{
  className?: string;
  message: string;
}>(), {
  className: '',
});
</script>

<template>
  <div class="empty-state-view" :class="className">
    <slot name="icon" />
    <p>{{ message }}</p>
    <slot name="action" />
  </div>
</template>

<style scoped>
.empty-state-view {
  display: grid;
  min-height: 140px;
  place-items: center;
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 14px;
  text-align: center;
}

.empty-state-view p {
  max-width: 540px;
  margin: 0;
  line-height: 1.6;
}
</style>
