<script setup lang="ts">
defineProps<{
  collapsed: boolean;
  href: string;
  isActive: boolean;
  title: string;
}>();

const emit = defineEmits<{
  navigate: [];
}>();
</script>

<template>
  <a
    :class="{ 'is-active': isActive, 'is-collapsed': collapsed }"
    :href="href"
    :title="title"
    @click.prevent="emit('navigate')"
  >
    <span class="nav-icon"><slot name="icon" /></span>
    <span class="sidebar-text">{{ title }}</span>
  </a>
</template>

<style scoped>
a {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  width: var(--sidebar-nav-item-width, 100%);
  height: 48px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  color: var(--smw-text-body);
  background: transparent;
  font-size: 14px;
  font-weight: 520;
  font-family: inherit;
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    color 180ms ease;
}

a:hover,
.is-active {
  background: var(--smw-bg-selected);
}

.nav-icon {
  position: relative;
  z-index: 1;
  display: grid;
  width: 58px;
  height: 48px;
  place-items: center;
  border-radius: 8px;
  flex: 0 0 58px;
}

.nav-icon :deep(svg) {
  flex: 0 0 auto;
}

.sidebar-text {
  position: relative;
  z-index: 1;
  min-width: 0;
  max-width: 150px;
  overflow: hidden;
  opacity: 1;
  white-space: nowrap;
  transform: translateX(0);
  transition:
    opacity 170ms ease,
    transform 220ms var(--sidebar-motion-easing, cubic-bezier(0.22, 0.76, 0.22, 1));
}

a.is-collapsed {
  justify-content: flex-start;
  gap: 0;
  padding: 0;
  margin-left: 0;
}

a.is-collapsed:hover,
a.is-collapsed.is-active {
  background: var(--smw-bg-selected);
}

a.is-collapsed:hover .nav-icon,
a.is-collapsed.is-active .nav-icon {
  background: transparent;
}

a.is-collapsed .sidebar-text {
  opacity: 0;
  transform: translateX(-6px);
}
</style>
