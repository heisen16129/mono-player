<template>
  <div class="sleep-timer-or">
    <span></span>
    <small>或</small>
    <span></span>
  </div>
</template>

<style scoped>
.sleep-timer-or {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 18px;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.sleep-timer-or span {
  height: 1px;
  background: var(--smw-border-soft);
}
</style>
