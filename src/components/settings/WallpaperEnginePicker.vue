<script setup lang="ts">
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, RefreshCw, X } from '@lucide/vue';
import { computed, onMounted, ref } from 'vue';
import {
  listWallpaperEngineProjects,
  type WallpaperEngineLibrarySnapshot,
  type WallpaperEngineProject,
} from '../../services/wallpaperEngine';
import { artworkDisplaySrc, filePathToArtworkUrl } from '../../utils/artwork';

const props = defineProps<{
  locale: string;
  manualRoot: string;
  selectedId: string;
}>();

const emit = defineEmits<{
  close: [];
  select: [project: WallpaperEngineProject, manualRoot: string];
}>();

const isEnglish = computed(() => props.locale === 'en-US');
const snapshot = ref<WallpaperEngineLibrarySnapshot | null>(null);
const manualRoot = ref(props.manualRoot);
const loading = ref(false);
const error = ref('');

function previewUrl(project: WallpaperEngineProject) {
  const path = project.previewPath || project.mediaPath;
  return path ? artworkDisplaySrc(filePathToArtworkUrl(path)) : '';
}

function projectBadge(project: WallpaperEngineProject) {
  if (project.enginePlayable) return 'Scene';
  if (project.mediaType === 'video') return isEnglish.value ? 'Video' : '视频';
  if (project.mediaType === 'image') return isEnglish.value ? 'Image' : '图片';
  if (project.projectType === 'web') return isEnglish.value ? 'Web preview' : 'Web 预览';
  if (project.projectType === 'application') return isEnglish.value ? 'App preview' : '应用预览';
  return isEnglish.value ? 'Preview' : '仅预览';
}

function canSelectProject(project: WallpaperEngineProject) {
  return project.playable || project.enginePlayable || Boolean(project.previewPath);
}

async function refresh() {
  loading.value = true;
  error.value = '';
  try {
    snapshot.value = await listWallpaperEngineProjects(manualRoot.value);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    loading.value = false;
  }
}

async function chooseDirectory() {
  const selected = await open({
    directory: true,
    multiple: false,
    title: isEnglish.value ? 'Choose Wallpaper Engine project directory' : '选择 Wallpaper Engine 项目目录',
  });
  if (typeof selected !== 'string') return;
  manualRoot.value = selected;
  await refresh();
}

function selectProject(project: WallpaperEngineProject) {
  if (!canSelectProject(project)) return;
  emit('select', project, manualRoot.value);
}

onMounted(refresh);
</script>

<template>
  <Teleport to="body">
    <div class="wallpaper-picker-backdrop" @click.self="emit('close')">
      <section class="wallpaper-picker" role="dialog" aria-modal="true" :aria-label="isEnglish ? 'Wallpaper Engine library' : 'Wallpaper Engine 壁纸库'">
        <header>
          <span>
            <strong>{{ isEnglish ? 'Wallpaper Engine library' : 'Wallpaper Engine 壁纸库' }}</strong>
            <small v-if="snapshot">
              {{ snapshot.count }} {{ isEnglish ? 'projects' : '个项目' }}
              · {{ snapshot.engineAvailable ? (isEnglish ? 'Engine ready' : '引擎已就绪') : (isEnglish ? 'Engine not found' : '未找到 Wallpaper Engine') }}
            </small>
            <small v-else>{{ isEnglish ? 'Scanning Steam libraries' : '正在扫描 Steam 库' }}</small>
          </span>
          <button type="button" :title="isEnglish ? 'Close' : '关闭'" @click="emit('close')"><X :size="18" /></button>
        </header>

        <div class="picker-toolbar">
          <button type="button" @click="chooseDirectory"><FolderOpen :size="15" />{{ isEnglish ? 'Import directory' : '导入目录' }}</button>
          <button type="button" :disabled="loading" @click="refresh"><RefreshCw :size="15" :class="{ spinning: loading }" />{{ isEnglish ? 'Rescan' : '重新扫描' }}</button>
          <span v-if="manualRoot" :title="manualRoot">{{ manualRoot }}</span>
        </div>

        <p v-if="error" class="picker-status error">{{ error }}</p>
        <p v-else-if="loading && !snapshot" class="picker-status">{{ isEnglish ? 'Scanning…' : '正在扫描…' }}</p>
        <p v-else-if="snapshot && !snapshot.projects.length" class="picker-status">
          {{ isEnglish ? 'No Wallpaper Engine projects were found.' : '没有找到 Wallpaper Engine 项目。' }}
        </p>

        <div v-else class="project-grid">
          <button
            v-for="project in snapshot?.projects"
            :key="project.id"
            class="project-item"
            :class="{ selected: project.id === selectedId, disabled: !canSelectProject(project) }"
            type="button"
            :disabled="!canSelectProject(project)"
            @click="selectProject(project)"
          >
            <span class="project-preview">
              <img v-if="previewUrl(project)" :src="previewUrl(project)" alt="" loading="lazy" />
              <span v-else>WE</span>
              <small>{{ projectBadge(project) }}</small>
            </span>
            <span class="project-copy">
              <strong :title="project.title">{{ project.title }}</strong>
              <small>{{ project.sourceLabel }}</small>
            </span>
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.wallpaper-picker-backdrop {
  position: fixed;
  z-index: 10000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.48);
  backdrop-filter: blur(8px);
}

.wallpaper-picker {
  display: grid;
  width: min(860px, 100%);
  max-height: min(720px, calc(100vh - 48px));
  grid-template-rows: auto auto minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--smw-border-strong);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-panel);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
}

header,
.picker-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--smw-border);
}

header { justify-content: space-between; }
header > span { display: grid; gap: 2px; }
header strong { font-size: 15px; }
header small,
.picker-toolbar > span,
.project-copy small { color: var(--smw-text-secondary); font-size: 11px; }

header button,
.picker-toolbar button {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--smw-border);
  border-radius: 7px;
  color: inherit;
  background: var(--smw-bg-input);
  cursor: pointer;
}

header button { width: 32px; padding: 0; }
.picker-toolbar > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.picker-toolbar button:disabled { opacity: .5; }
.spinning { animation: spin .8s linear infinite; }

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  overflow: auto;
  padding: 12px;
  scrollbar-color: var(--smw-scrollbar-thumb) transparent;
  scrollbar-width: thin;
}

.project-item {
  display: grid;
  min-width: 0;
  gap: 7px;
  padding: 7px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: inherit;
  background: var(--smw-bg-canvas);
  text-align: left;
  cursor: pointer;
}

.project-item:hover:not(:disabled),
.project-item.selected { border-color: var(--smw-button-primary); background: var(--smw-bg-selected); }
.project-item.disabled { opacity: .46; cursor: default; }
.project-preview { position: relative; display: grid; aspect-ratio: 16 / 10; place-items: center; overflow: hidden; border-radius: 6px; background: var(--smw-bg-input); }
.project-preview img { width: 100%; height: 100%; object-fit: cover; }
.project-preview > span { color: var(--smw-text-secondary); font-size: 18px; font-weight: 760; }
.project-preview small { position: absolute; right: 5px; bottom: 5px; padding: 2px 5px; border-radius: 4px; color: #fff; background: rgba(0, 0, 0, .68); font-size: 9px; }
.project-copy { display: grid; min-width: 0; gap: 2px; }
.project-copy strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.picker-status { margin: 0; padding: 34px 16px; color: var(--smw-text-secondary); text-align: center; }
.picker-status.error { color: var(--smw-danger, #d14343); }

@keyframes spin { to { transform: rotate(360deg); } }
</style>
