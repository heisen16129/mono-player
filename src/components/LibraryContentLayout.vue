<template>
  <section class="library-content-layout">
    <Transition name="library-panel-slide" appear>
      <div class="library-panel-slot">
        <slot name="panel"></slot>
      </div>
    </Transition>
    <slot name="detail"></slot>
  </section>
</template>

<style scoped>
.library-content-layout {
  grid-column: 2 / 4;
  display: grid;
  grid-template-columns: var(--library-width) minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: var(--smw-bg-workspace);
}

.library-panel-slot {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.library-panel-slot :deep(.library-panel) {
  width: 100%;
  height: 100%;
}

:deep(.library-panel) {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  padding: 18px 20px 20px;
  overflow: hidden;
  border-right: 1px solid var(--smw-library-border);
  background: var(--smw-library-bg);
}

:deep(.panel-title) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

:deep(.panel-title h1) {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
}

.library-panel-slide-enter-active,
.library-panel-slide-leave-active {
  transition: opacity 180ms ease;
}

.library-panel-slide-enter-from,
.library-panel-slide-leave-to {
  opacity: 0;
}

.library-panel-slide-enter-active.library-panel-slot,
.library-panel-slide-leave-active.library-panel-slot {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.library-panel-slide-leave-active.library-panel-slot {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--sidebar-width);
  z-index: 6;
  width: var(--library-width);
}

.sidebar-collapsed .library-panel-slide-leave-active.library-panel-slot {
  left: var(--sidebar-collapsed-width);
}

.library-panel-slide-enter-from.library-panel-slot,
.library-panel-slide-leave-to.library-panel-slot {
  transform: translateX(-32px);
}

.library-panel-slide-leave-active {
  pointer-events: none;
}
</style>
