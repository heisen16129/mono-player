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

.settings-header {
  border-bottom: 1px solid var(--smw-border);
}

.settings-header .page-header-title {
  margin: 0 0 18px;
  font-size: 30px;
  font-weight: 760;
  line-height: 1.1;
}

.theme-toolbar {
  display: flex;
  align-items: center;
  min-height: 42px;
}

.theme-view-title {
  color: var(--smw-text-primary);
  font-size: 18px;
  font-weight: 720;
  line-height: 1.2;
}

.plugin-header {
  display: flex;
  gap: 24px;
  align-items: center;
  justify-content: space-between;
  padding: 0 116px 18px 0;
  border-bottom: 1px solid var(--smw-border);
}

.plugin-header .page-header-title {
  margin: 0 0 6px;
  color: var(--smw-text-primary);
  font-size: 28px;
  font-weight: 760;
  line-height: 1.15;
}

.plugin-header .page-header-subtitle {
  color: var(--smw-text-secondary);
  font-size: 13px;
}
</style>
