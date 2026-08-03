<script setup lang="ts">
defineProps<{
  name: string;
  url: string;
}>();
</script>

<template>
  <span class="subscription-card-body">
    <strong>{{ name }}</strong>
    <small>{{ url }}</small>
  </span>
</template>

<style scoped>
.subscription-card-body {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.subscription-card-body strong,
.subscription-card-body small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subscription-card-body strong {
  color: var(--smw-text-primary);
  font-size: 13px;
}

.subscription-card-body small {
  color: var(--smw-text-secondary);
  font-size: 12px;
}
</style>
