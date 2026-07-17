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
</style>
