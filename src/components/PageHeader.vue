<script setup lang="ts">
withDefaults(defineProps<{
  subtitle?: string;
  title: string;
  titleClass?: string;
  titleTag?: 'h1' | 'h2';
}>(), {
  subtitle: '',
  titleClass: '',
  titleTag: 'h1',
});
</script>

<template>
  <header class="page-header">
    <div class="page-header-copy">
      <component :is="titleTag" class="page-header-title" :class="titleClass">{{ title }}</component>
      <p v-if="subtitle" class="page-header-subtitle">{{ subtitle }}</p>
    </div>
    <slot />
    <div v-if="$slots.actions" class="page-header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  min-width: 0;
}

.page-header-copy {
  min-width: 0;
}

.page-header-title,
.page-header-subtitle {
  margin: 0;
}

.page-header-actions {
  min-width: 0;
}

</style>
