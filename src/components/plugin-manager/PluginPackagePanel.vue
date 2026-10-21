<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { inspectPluginPackage, installPluginPackage, listPluginPackages } from '../../services/pluginPackages';
import type { PackageInstallRequest } from '../../services/pluginPackages';
import type { InstalledPluginPackage, InspectedPluginPackage } from '../../types/pluginPackage';
import { PLUGINS_CHANGED_EVENT } from '../../composables/useMusicSourcePluginAvailability';
import PluginConfigFields from '../settings/PluginConfigFields.vue';
import { getPluginConfig, savePluginConfig } from '../../services/plugins';
import type { PluginConfig } from '../../types/plugin';

const emit = defineEmits<{ notify: [message: string, variant?: 'success' | 'error']; installed: [] }>();
const pending = ref<{ path: string; inspected: InspectedPluginPackage; request?: PackageInstallRequest } | null>(null);
const permissions = ref<string[]>([]);
const busy = ref(false);
const settingsPlugin = ref<InstalledPluginPackage | null>(null);
const config = ref<PluginConfig>({});
async function openSettings(id:string) {
  settingsPlugin.value = (await listPluginPackages()).find(p => p.id === id) ?? null;
  if (settingsPlugin.value) config.value = await getPluginConfig(id);
}
async function saveSettings() {
  if (!settingsPlugin.value) return;
  try { config.value = await savePluginConfig(settingsPlugin.value.id,config.value); emit('notify','设置已保存','success'); }
  catch (reason) { emit('notify',message(reason),'error'); }
}
let disposed = false;
const labels: Record<string, string> = {
  'library.read': '读取曲库', 'library.write': '修改曲库', 'player.read': '读取播放状态', 'player.control': '控制播放',
  'playlists.read': '读取歌单', 'playlists.write': '修改歌单', 'favorites.read': '读取收藏', 'favorites.write': '修改收藏',
  'lyrics.read': '读取歌词', 'lyrics.write': '修改歌词', 'artwork.read': '读取封面', 'media.read': '读取音频',
  'sources.search': '搜索音源', 'sources.import': '导入歌曲', 'history.write': '记录播放历史', storage: '保存插件数据',
  'service.run': '运行本地后台（可执行程序及访问文件）', 'files.choose': '选择本地文件或文件夹', 'files.reveal': '打开插件输出位置', network: '访问网络', 'audio.read': '读取音频分析数据', 'speaker-service': '运行音箱服务',
};
const message = (reason: unknown) => reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : String(reason);
async function importPackage() {
  if (busy.value) return;
  busy.value = true;
  try {
    const path = await open({ multiple: false, filters: [{ name: 'Mono 插件包', extensions: ['zip'] }] });
    if (typeof path !== 'string') return;
    await reviewPackage(path);
  } catch (reason) { emit('notify', message(reason), 'error'); }
  finally { busy.value = false; }
}
async function reviewPackage(path: string, request?: PackageInstallRequest) {
  try {
    const inspected = await inspectPluginPackage(path);
    if (disposed) throw new Error('插件管理已关闭');
    cancelInstall();
    pending.value = { path, inspected, request };
    permissions.value = [...inspected.manifest.permissions];
  } catch (reason) { request?.reject(new Error(message(reason))); throw reason; }
}
function cancelInstall() {
  pending.value?.request?.reject(new Error('已取消安装'));
  pending.value = null;
}
async function install() {
  if (!pending.value || busy.value) return;
  busy.value = true;
  try {
    const { path, inspected } = pending.value;
    await installPluginPackage(path, inspected.revision, permissions.value);
    pending.value.request?.resolve();
    pending.value = null;
    window.dispatchEvent(new CustomEvent(PLUGINS_CHANGED_EVENT));
    emit('installed');
    emit('notify', `已安装 ${inspected.manifest.name}`, 'success');
  } catch (reason) { emit('notify', message(reason), 'error'); }
  finally { busy.value = false; }
}
onBeforeUnmount(() => { disposed = true; cancelInstall(); });

defineExpose({ importPackage, openSettings, reviewPackage });
</script>

<template>
  <Teleport to="body">
    <div v-if="settingsPlugin || pending" class="package-backdrop">
      <section v-if="settingsPlugin" class="package-review" role="dialog" aria-modal="true" :aria-label="`${settingsPlugin.name}设置`">
        <h3>{{ settingsPlugin.name }}设置</h3>
        <PluginConfigFields :config="config" :fields="settingsPlugin.configSchema?.fields ?? []" locale="zh-CN" :scope-id="settingsPlugin.id" @update="config = $event" />
        <p v-if="!settingsPlugin.configSchema?.fields.length">此插件没有可配置项目。</p>
        <div class="package-toolbar"><button @click="saveSettings">保存</button><button @click="settingsPlugin = null">关闭</button></div>
      </section>
      <section v-else-if="pending" class="package-review" role="dialog" aria-modal="true" aria-label="确认插件安装">
        <h3>{{ pending.inspected.manifest.name }} · {{ pending.inspected.manifest.version }}</h3>
        <p>{{ pending.inspected.manifest.description }}</p>
        <p>安装后允许此插件使用以下权限，可取消不需要的权限：</p>
        <div class="permissions">
          <label v-for="permission in pending.inspected.manifest.permissions" :key="permission">
            <input v-model="permissions" type="checkbox" :value="permission" :disabled="busy">
            {{ labels[permission] || permission }}
          </label>
          <span v-if="!pending.inspected.manifest.permissions.length">此插件未申请额外权限</span>
        </div>
        <div class="package-toolbar">
          <button type="button" :disabled="busy" @click="install">确认安装</button>
          <button type="button" :disabled="busy" @click="cancelInstall">取消</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.package-backdrop { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgb(0 0 0 / 25%); }
.package-review { width: min(560px, 100%); max-height: 80vh; overflow: auto; padding: 24px; border: 1px solid var(--smw-border); border-radius: 12px; background: var(--smw-bg-workspace); color: var(--smw-text-primary); box-shadow: 0 16px 48px rgb(0 0 0 / 15%); }
.package-toolbar { display: flex; justify-content: flex-end; gap: 10px; }
button { padding: 6px 12px; border: 1px solid var(--smw-border); border-radius: 8px; background: var(--smw-bg-input); color: var(--smw-text-primary); cursor: pointer; }
button:disabled { opacity: .5; cursor: default; }
h3 { margin: 0; }
.permissions { display: flex; flex-wrap: wrap; gap: 12px 20px; margin-bottom: 20px; }
.permissions label { display: flex; align-items: center; gap: 6px; }
</style>
