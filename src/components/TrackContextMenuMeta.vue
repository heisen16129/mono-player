<script setup lang="ts">
import { Disc3, IdCard, User } from '@lucide/vue';

defineProps<{
  albumLabel: string;
  artistLabel: string;
  sourceId: string;
  sourceLabel: string;
}>();
</script>

<template>
  <div class="context-menu-meta">
    <div>
      <IdCard :size="15" />
      <span>ID: {{ sourceLabel }}@{{ sourceId }}</span>
    </div>
    <div>
      <User :size="15" />
      <span>作者: {{ artistLabel }}</span>
    </div>
    <div>
      <Disc3 :size="15" />
      <span>专辑: {{ albumLabel }}</span>
    </div>
  </div>
</template>
