<template>
  <span class="theme-card-cover" aria-hidden="true"></span>
</template>

<style scoped>
.theme-card-cover {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(var(--cover-sidebar), var(--cover-sidebar)) 0 0 / 42px 100% no-repeat,
    linear-gradient(var(--cover-border), var(--cover-border)) 42px 0 / 1px 100% no-repeat,
    linear-gradient(var(--cover-selected), var(--cover-selected)) 9px 15px / 24px 11px no-repeat,
    linear-gradient(var(--cover-line), var(--cover-line)) 55px 15px / 34px 5px no-repeat,
    linear-gradient(var(--cover-line-soft), var(--cover-line-soft)) 55px 27px / 70px 4px no-repeat,
    linear-gradient(var(--cover-line-soft), var(--cover-line-soft)) 55px 39px / 58px 4px no-repeat,
    linear-gradient(var(--cover-selected), var(--cover-selected)) 55px 56px / 76px 13px no-repeat,
    linear-gradient(var(--cover-line-soft), var(--cover-line-soft)) 55px 76px / 64px 4px no-repeat,
    var(--cover-page);
}

.theme-card-cover::before,
.theme-card-cover::after {
  position: absolute;
  content: "";
}

.theme-card-cover::before {
  right: 14px;
  bottom: 13px;
  width: 28px;
  height: 18px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--cover-line) 14%, transparent);
}

.theme-card-cover::after {
  right: 18px;
  top: 15px;
  width: 26px;
  height: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--cover-line) 18%, transparent);
}
</style>
