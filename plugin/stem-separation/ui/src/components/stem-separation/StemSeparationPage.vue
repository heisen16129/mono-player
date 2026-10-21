<script setup lang="ts">
import StemSeparationContent from './StemSeparationContent.vue';

</script>

<template>
  <div class="separation-page">
    <h1>人声／伴奏分离</h1>
    <StemSeparationContent />
  </div>
</template>

<style scoped>
.separation-page { flex: 1; min-height: 0; overflow-y: auto; padding: 0 16px 24px; }
h1 { margin: 0 20px 24px; font-size: 28px; color: var(--smw-text-body); }
.separation-page :deep(.separation-content) { max-width: 800px; }
</style>
