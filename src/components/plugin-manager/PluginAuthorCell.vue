<script setup lang="ts">
defineProps<{
  author: string | null | undefined;
}>();
</script>

<template>
  <span>{{ author || '未知作者' }}</span>
</template>
