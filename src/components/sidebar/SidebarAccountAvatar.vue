<script setup lang="ts">
import { UserRound } from '@lucide/vue';
</script>

<template>
  <span class="avatar" aria-hidden="true">
    <UserRound :size="20" />
    <i></i>
  </span>
</template>

<style scoped>
.avatar {
  position: relative;
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  color: var(--smw-avatar-fg);
  background: linear-gradient(145deg, var(--smw-avatar-bg), var(--smw-avatar-bg-deep));
  box-shadow: inset 0 0 0 1px var(--smw-avatar-border);
  transform: translateZ(0);
}

.avatar :deep(svg) {
  display: block;
  width: 20px;
  height: 20px;
  transform: translateZ(0);
}

.avatar i {
  position: absolute;
  right: -2px;
  bottom: 0;
  width: 13px;
  height: 13px;
  border: 2px solid var(--smw-avatar-status-border);
  border-radius: 50%;
  background: var(--smw-status-green);
}
</style>
