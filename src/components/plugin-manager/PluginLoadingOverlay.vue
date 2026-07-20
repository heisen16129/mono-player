<template>
  <div class="plugin-loading-overlay" role="status" aria-live="polite">
    <div class="plugin-loading-dialog">
      <div class="install-bars" aria-hidden="true"><span></span><span></span><span></span></div>
      <strong>正在添加订阅...</strong>
      <p>正在读取插件源</p>
    </div>
  </div>
</template>

<style scoped>
.plugin-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--smw-bg-workspace) 76%, transparent);
  backdrop-filter: blur(2px);
}

.plugin-loading-dialog {
  display: grid;
  justify-items: center;
  min-width: 260px;
  padding: 32px 36px 30px;
  border: 1px solid var(--smw-border);
  border-radius: 10px;
  background: var(--smw-bg-input);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
}

.plugin-loading-dialog strong {
  margin-top: 14px;
  color: var(--smw-text-primary);
  font-size: 14px;
  font-weight: 650;
}

.plugin-loading-dialog p {
  margin: 6px 0 0;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.install-bars {
  display: inline-flex;
  gap: 8px;
  align-items: end;
  height: 58px;
}

.install-bars span {
  width: 15px;
  border-radius: 3px 3px 1px 1px;
  background: var(--smw-button-primary);
  animation: installBars 820ms ease-in-out infinite;
}

.install-bars span:nth-child(1) {
  height: 46px;
}

.install-bars span:nth-child(2) {
  height: 30px;
  animation-delay: 110ms;
}

.install-bars span:nth-child(3) {
  height: 34px;
  animation-delay: 220ms;
}

@keyframes installBars {
  0%,
  100% {
    transform: scaleY(0.72);
    opacity: 0.66;
  }

  45% {
    transform: scaleY(1);
    opacity: 1;
  }
}
</style>
