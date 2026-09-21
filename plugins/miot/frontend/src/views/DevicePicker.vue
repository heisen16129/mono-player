<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { get, query } from '../api';
import type { PlayerStatus } from '../types';
import SlButton from '../ui/SlButton.vue';
import SlIcon from '../ui/SlIcon.vue';
import { deviceId, deviceName, selectDevice, state } from '../store';

const emit = defineEmits<{ close: [] }>();
const playback = ref<Record<string, string>>({});
let disposed = false;
const playbackKey = (accountId: string, id: string) => JSON.stringify([accountId, id]);
onUnmounted(() => { disposed = true; });
onMounted(() => {
  for (const account of state.devices) for (const device of account.devices) {
    const id = deviceId(device);
    const key = playbackKey(account.account_id, id);
    if (device.presence !== 'online') { playback.value[key] = '设备离线'; continue; }
    playback.value[key] = '正在获取播放信息…';
    void get<PlayerStatus>(`/player/status${query({ account_id: account.account_id, device_id: id })}`)
      .then(status => {
        if (disposed) return;
        const song = status.current_song;
        const label = status.state === 'playing' ? '正在播放' : status.state === 'paused' ? '已暂停' : '未播放';
        playback.value[key] = (status.state === 'playing' || status.state === 'paused') && song?.title
          ? `${label}：${song.title}${song.artist ? ` · ${song.artist}` : ''}`
          : status.state === 'playing' ? '正在播放 · 暂无歌曲信息' : label;
      }).catch(() => { if (!disposed) playback.value[key] = '暂时无法获取播放信息'; });
  }
});

async function choose(accountId: string, selectedDeviceId: string) {
  await selectDevice(accountId, selectedDeviceId);
  emit('close');
}
</script>

<template>
  <div class="dialog-overlay" @click.self="emit('close')">
    <div class="dialog device-picker-dialog" role="dialog" aria-modal="true" aria-label="选择播放设备">
      <h2 class="dialog-title">选择播放设备</h2>
      <div v-if="state.devices.length" class="device-picker-list">
        <section v-for="account in state.devices" :key="account.account_id" class="device-picker-account">
          <h3>{{ account.account_name || account.account_id }}</h3>
          <button
            v-for="device in account.devices"
            :key="deviceId(device)"
            type="button"
            class="device-picker-row"
            :class="{ selected: account.account_id === state.currentAccountId && deviceId(device) === state.currentDeviceId }"
            @click="choose(account.account_id, deviceId(device))"
          >
            <span class="device-picker-icon"><SlIcon name="speaker" :size="20" /></span>
            <span class="device-picker-copy">
              <strong>{{ deviceName(device) }}</strong>
              <small>{{ device.model || device.hardware || 'MIoT 设备' }} · {{ device.presence === 'online' ? '在线' : '离线' }}</small>
            </span>
            <span class="device-playback" :title="playback[playbackKey(account.account_id, deviceId(device))]">{{ playback[playbackKey(account.account_id, deviceId(device))] }}</span>
            <SlIcon
              v-if="account.account_id === state.currentAccountId && deviceId(device) === state.currentDeviceId"
              name="check"
              :size="20"
            />
          </button>
        </section>
      </div>
      <div v-else class="empty-state">暂无可选设备，请先在设置中添加账号。</div>
      <div class="dialog-actions">
        <SlButton variant="text" label="取消" @click="emit('close')" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.device-picker-copy { min-width: 0; flex: 1 1 45%; }
.device-playback { flex: 1 1 55%; min-width: 0; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; line-height: 1.5; color: var(--md-on-surface-variant); }
</style>
