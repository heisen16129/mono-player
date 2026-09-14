<script setup lang="ts">
import type { RustCacheStatusState } from '../../services/playerBackend';

defineProps<{ directories: RustCacheStatusState['directories']; locale: string }>();

const labels: Record<string, [string, string]> = {
  'online-audio-cache': ['在线音频缓存', 'Online audio'],
  'plugin-lyrics': ['歌词缓存', 'Lyrics'],
  'plugin-covers': ['在线封面缓存', 'Online artwork'],
  'cover-thumbnails': ['封面缩略图', 'Artwork thumbnails'],
  'cover-originals': ['封面原图', 'Original artwork'],
  'plugin-wasm': ['插件程序缓存', 'Plugin binaries'],
  '.': ['其他缓存文件', 'Other cache files'],
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
</script>

<template>
  <div class="cache-directories">
    <div v-for="directory in directories" :key="directory.path" class="cache-directory">
      <div class="directory-heading">
        <span>{{ labels[directory.name]?.[locale === 'en-US' ? 1 : 0] ?? directory.name }}</span>
        <strong>{{ formatBytes(directory.bytes) }}</strong>
      </div>
      <p :title="directory.path">{{ directory.path }}</p>
    </div>
  </div>
</template>

<style scoped>
.cache-directories {
  display: grid;
  min-width: 0;
  gap: 12px;
}

.directory-heading {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--smw-text-body);
  font-size: 11px;
}

.directory-heading strong {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.cache-directory p {
  margin: 3px 0 0;
  overflow-wrap: anywhere;
  color: var(--smw-text-secondary);
  font-size: 10px;
  line-height: 1.5;
}
</style>
