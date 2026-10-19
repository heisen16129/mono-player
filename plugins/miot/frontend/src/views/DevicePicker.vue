<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { get, post, query } from '../api';
import type { PlayerStatus } from '../types';
import SlButton from '../ui/SlButton.vue';
import SlIcon from '../ui/SlIcon.vue';
import { deviceId, deviceName, selectDevice, playAllSpeakers, notify, state } from '../store';

const emit = defineEmits<{ close: [] }>();
const playback = ref<Record<string, string>>({});
const playing = ref<Record<string, boolean>>({});
const controlling = ref(false);
let disposed = false;
const playbackKey = (accountId: string, id: string) => JSON.stringify([accountId, id]);
onUnmounted(() => { disposed = true; });
function refreshPlayback() {
  for (const account of state.devices) for (const device of account.devices) {
    const id = deviceId(device);
    const key = playbackKey(account.account_id, id);
    if (device.presence !== 'online') { playback.value[key] = '设备离线'; continue; }
    playback.value[key] = '正在获取播放信息…';
    void get<PlayerStatus>(`/player/status${query({ account_id: account.account_id, device_id: id })}`)
      .then(status => {
        if (disposed) return;
        playing.value[key] = status.state === 'playing';
        const song = status.current_song;
        playback.value[key] = (status.state === 'playing' || status.state === 'paused') && song?.title
          ? `${song.title}${song.artist ? ` · ${song.artist}` : ''}`
          : status.state === 'playing' || status.state === 'paused' ? '暂无歌曲信息' : '未播放';
      }).catch(() => { if (!disposed) playback.value[key] = '暂时无法获取播放信息'; });
  }
}
onMounted(refreshPlayback);

async function toggleDevice(accountId: string, id: string) {
  if (controlling.value) return;
  controlling.value = true;
  try {
    await post('/player/toggle', { account_id: accountId, device_id: id });
    refreshPlayback();
  } catch (error) { notify(error instanceof Error ? error.message : String(error), 'error'); }
  finally { controlling.value = false; }
}

async function choose(accountId: string, selectedDeviceId: string) {
  await selectDevice(accountId, selectedDeviceId);
  emit('close');
}

async function playAll(action: 'play' | 'pause') {
  try { if (await playAllSpeakers(action)) emit('close'); }
  catch (error) { notify(error instanceof Error ? error.message : String(error), 'error'); }
}
</script>

<template>
  <div class="dialog-overlay" @click.self="emit('close')">
    <div class="dialog device-picker-dialog" role="dialog" aria-modal="true" aria-label="选择播放设备">
      <h2 class="dialog-title">选择播放设备</h2>
      <div v-if="state.devices.length" class="device-picker-list">
        <section v-for="account in state.devices" :key="account.account_id" class="device-picker-account">
          <h3>{{ account.account_name || account.account_id }}</h3>
          <div
            v-for="device in account.devices"
            :key="deviceId(device)"
            class="device-picker-row"
            :class="{ selected: account.account_id === state.currentAccountId && deviceId(device) === state.currentDeviceId }"
          >
            <button type="button" class="device-control device-picker-icon" :disabled="device.presence !== 'online' || controlling || state.playerBusy"
              :aria-label="`${playing[playbackKey(account.account_id, deviceId(device))] ? '暂停' : '播放'}${deviceName(device)}`"
              :title="playing[playbackKey(account.account_id, deviceId(device))] ? '暂停' : '播放'"
              @click="toggleDevice(account.account_id, deviceId(device))">
              <SlIcon name="speaker" :size="26" />
              <span class="device-control-badge"><SlIcon :name="playing[playbackKey(account.account_id, deviceId(device))] ? 'pause' : 'play_arrow'" player-icon :size="20" /></span>
            </button>
            <button type="button" class="device-select" :aria-pressed="account.account_id === state.currentAccountId && deviceId(device) === state.currentDeviceId" @click="choose(account.account_id, deviceId(device))">
            <span class="device-picker-copy">
              <strong>{{ deviceName(device) }}</strong>
              <small>{{ device.model || device.hardware || 'MIoT 设备' }} · {{ device.presence === 'online' ? '在线' : '离线' }}</small>
            </span>
            <span class="device-playback" :title="playback[playbackKey(account.account_id, deviceId(device))]">{{ playback[playbackKey(account.account_id, deviceId(device))] }}</span>
            </button>
          </div>
        </section>
      </div>
      <div v-else class="empty-state">暂无可选设备，请先在设置中添加账号。</div>
      <div class="dialog-actions">
        <SlButton variant="filled" label="一键播放" :disabled="state.playerBusy || !state.devices.some(account => account.devices.some(device => device.presence === 'online'))" @click="playAll('play')" />
        <SlButton variant="outlined" label="一键暂停" :disabled="state.playerBusy || !state.devices.some(account => account.devices.some(device => device.presence === 'online'))" @click="playAll('pause')" />
        <SlButton variant="text" label="取消" @click="emit('close')" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.device-control { position: relative; width: 44px; height: 44px; flex: 0 0 44px; margin-right: 4px; border: 0; color: var(--md-primary); cursor: pointer; }
.device-control:disabled { opacity: .45; cursor: default; }
.device-control-badge { position: absolute; right: -4px; bottom: -3px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--md-primary); color: var(--md-on-primary); border: 2px solid var(--md-surface); }
.device-select { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; padding: 0; border: 0; background: transparent; color: inherit; text-align: left; font: inherit; cursor: pointer; }
.device-control:focus-visible,.device-select:focus-visible { outline: 2px solid var(--md-primary); outline-offset: 3px; }
.device-picker-copy { min-width: 0; flex: 1 1 45%; }
.device-playback { flex: 1 1 55%; min-width: 0; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; line-height: 1.5; color: var(--md-on-surface-variant); }
</style>
