<script setup lang="ts">
import { ShieldCheck, Wifi } from '@lucide/vue';

defineProps<{
  localizedPermission: (permission: string) => string;
  permissions: string[];
}>();
</script>

<template>
  <section class="plugin-detail-permissions">
    <h3>权限</h3>
    <div v-if="permissions.length > 0" class="plugin-permission-list">
      <span v-for="permission in permissions" :key="permission">
        <Wifi v-if="permission === 'network'" :size="14" />
        <ShieldCheck v-else :size="14" />
        {{ localizedPermission(permission) }}
      </span>
    </div>
    <p v-else class="plugin-muted-text">无需额外权限</p>
  </section>
</template>

<style scoped>
.plugin-detail-permissions {
  display: grid;
  gap: 8px;
  padding-top: 2px;
}

.plugin-detail-permissions h3,
.plugin-muted-text {
  margin: 0;
}

.plugin-detail-permissions h3 {
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 740;
}

.plugin-permission-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.plugin-permission-list span {
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

.plugin-muted-text {
  color: var(--smw-text-secondary);
  font-size: 12px;
  line-height: 1.55;
}
</style>
