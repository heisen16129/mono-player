<script setup lang="ts">
defineProps<{
  date: string;
  subtitle: string;
  title: string;
}>();
</script>

<template>
  <div class="collection-hero-text">
    <h2>{{ title }}</h2>
    <p>{{ subtitle }}</p>
    <small>{{ date }}</small>
  </div>
</template>

<style scoped>
.collection-hero-text {
  min-width: 0;
}

.collection-hero-text h2 {
  margin: 0 0 2px;
  color: var(--smw-text-primary);
  font-size: 34px;
  font-weight: 720;
  line-height: 1.16;
}

.collection-hero-text p {
  margin: 0 0 18px;
  color: var(--smw-text-body);
  font-size: 21px;
  font-weight: 560;
}

.collection-hero-text small {
  color: var(--smw-text-secondary);
  font-size: 13px;
}

@media (max-height: 760px) and (min-width: 821px) {
  .collection-hero-text h2 {
    font-size: 28px;
  }

  .collection-hero-text p {
    margin-bottom: 12px;
    font-size: 18px;
  }
}

@media (max-height: 660px) and (min-width: 821px) {
  .collection-hero-text h2 {
    font-size: 24px;
  }

  .collection-hero-text p {
    margin-bottom: 8px;
    font-size: 15px;
  }

  .collection-hero-text small {
    font-size: 12px;
  }
}
</style>
