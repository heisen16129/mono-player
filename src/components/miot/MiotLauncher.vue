<script setup lang="ts">
import { ref } from 'vue';
import { invokeApi } from '../../services/api';
defineProps<{ disabled?: boolean }>();
const visible = ref(false);
const url = ref('');
const error = ref('');
const busy = ref(false);
async function open() {
  visible.value = true; busy.value = true; error.value = '';
  try { url.value = await invokeApi<string>('miot_open'); }
  catch (reason) { error.value = reason instanceof Error ? reason.message : String(reason); }
  finally { busy.value = false; }
}
</script>
<template>
  <button class="miot-launcher" type="button" :disabled="disabled" @click.stop="open">音箱</button>
  <Teleport to="body">
    <div v-if="visible" class="miot-backdrop" @click.self="visible = false">
      <section class="miot-dialog" role="dialog" aria-modal="true" aria-label="小爱音箱" @keydown.esc="visible = false">
        <header>
          <div class="miot-heading">
            <strong>小爱音箱</strong>
            <span class="miot-hint">关闭窗口后，语音监听和定时任务仍会运行。停用插件或退出 Mono 后停止。</span>
          </div>
          <button type="button" aria-label="关闭" @click="visible = false">×</button>
        </header>
        <p v-if="busy" role="status">正在启动音箱服务…</p>
        <p v-else-if="error" role="alert">{{ error }} <button type="button" @click="open">重试</button></p>
        <iframe v-else-if="url" :src="url" title="小爱音箱控制台" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerpolicy="no-referrer" />
      </section>
    </div>
  </Teleport>
</template>
<style scoped>
.miot-launcher { border: 0; padding: 0; background: transparent; color: var(--smw-text-body); font: inherit; cursor: pointer; }
.miot-launcher:disabled { opacity: .45; cursor: default; }
.miot-backdrop { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; background: #0005; padding: 24px; }
.miot-dialog { width: min(1080px, 100%); height: min(840px, 94vh); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--smw-border, #dde5ed); border-radius: 12px; background: var(--smw-bg, #fff); color: var(--smw-text-body); }
header { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; }
header button { flex: 0 0 auto; border: 0; background: transparent; color: inherit; font-size: 24px; cursor: pointer; }
.miot-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 14px; min-width: 0; }
.miot-heading strong { flex-shrink: 0; }
.miot-hint { font-size: 12px; opacity: .65; }
iframe { flex: 1; min-height: 0; width: 100%; border: 0; background: white; }
p { padding: 24px; }
</style>
