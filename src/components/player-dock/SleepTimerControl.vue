<script setup lang="ts">
import { Timer, X } from '@lucide/vue';
import BaseDialog from '../BaseDialog.vue';

defineProps<{
  action: 'stop' | 'exit' | 'finishTrack';
  executeAtLabel: string;
  hours: number;
  isActive: boolean;
  isDialogOpen: boolean;
  isPaused: boolean;
  isStatusOpen: boolean;
  minutes: number;
  presetMinutes: readonly number[];
  progressPercent: number;
  remainingLabel: string;
}>();

const emit = defineEmits<{
  clear: [];
  closeDialog: [];
  closeStatus: [];
  pause: [];
  resume: [];
  setAction: [action: 'stop' | 'exit' | 'finishTrack'];
  setHours: [value: number];
  setMinutes: [value: number];
  setPreset: [minutes: number];
  start: [];
  toggle: [];
}>();

function updateHours(event: Event) {
  emit('setHours', Number((event.target as HTMLInputElement).value));
}

function updateMinutes(event: Event) {
  emit('setMinutes', Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="sleep-timer-control">
    <div v-if="isStatusOpen" class="sleep-timer-status" role="dialog" aria-label="定时关闭状态">
      <header>
        <strong>定时关闭</strong>
        <button type="button" aria-label="关闭" @click="emit('closeStatus')">
          <X :size="15" />
        </button>
      </header>
      <div class="sleep-timer-status-progress" :style="{ '--timer-progress': `${progressPercent}%` }" aria-hidden="true">
        <i></i>
      </div>
      <p>
        剩余 {{ remainingLabel }}
        <span v-if="executeAtLabel">· 将于 {{ executeAtLabel }} 执行</span>
      </p>
      <div class="sleep-timer-status-actions">
        <button type="button" @click="isPaused ? emit('resume') : emit('pause')">
          {{ isPaused ? '继续计时' : '暂停计时' }}
        </button>
        <button type="button" @click="emit('clear')">取消定时</button>
      </div>
    </div>

    <button
      class="sleep-timer-button"
      :class="{ 'is-active': isActive || isPaused }"
      type="button"
      :aria-label="isActive ? `定时关闭剩余 ${remainingLabel}` : '定时关闭'"
      :title="isActive ? `定时关闭剩余 ${remainingLabel}` : '定时关闭'"
      @click="emit('toggle')"
    >
      <Timer :size="15" />
      <span v-if="isActive || isPaused">{{ remainingLabel }}</span>
    </button>
  </div>

  <Teleport to="body">
    <BaseDialog
      v-if="isDialogOpen"
      label="定时关闭"
      close-label="关闭"
      close-on-overlay
      title="定时关闭"
      panel-class="sleep-timer-dialog"
      width="min(478px, calc(100vw - 28px))"
      :z-index="500"
      @close="emit('closeDialog')"
    >
      <div class="sleep-timer-dialog-body">
        <p class="sleep-timer-section-label">选择时长</p>
        <div class="sleep-timer-presets">
          <button
            v-for="preset in presetMinutes"
            :key="preset"
            type="button"
            :class="{ 'is-active': hours * 60 + minutes === preset }"
            @click="emit('setPreset', preset)"
          >
            <strong>{{ preset }}</strong>
            <span>分钟</span>
          </button>
        </div>

        <div class="sleep-timer-or">
          <span></span>
          <small>或</small>
          <span></span>
        </div>

        <div class="sleep-timer-custom-time">
          <label>
            <input :value="hours" type="number" min="0" max="99" step="1" @input="updateHours" />
            <span>小时</span>
          </label>
          <label>
            <input :value="minutes" type="number" min="0" max="59" step="1" @input="updateMinutes" />
            <span>分钟</span>
          </label>
        </div>

        <p class="sleep-timer-section-label">结束时执行</p>
        <div class="sleep-timer-action-options">
          <label>
            <input type="radio" name="sleep-timer-action" value="exit" :checked="action === 'exit'" @change="emit('setAction', 'exit')" />
            <span>停止播放并退出程序</span>
          </label>
          <label>
            <input type="radio" name="sleep-timer-action" value="stop" :checked="action === 'stop'" @change="emit('setAction', 'stop')" />
            <span>仅停止播放（保持程序运行）</span>
          </label>
          <label>
            <input type="radio" name="sleep-timer-action" value="finishTrack" :checked="action === 'finishTrack'" @change="emit('setAction', 'finishTrack')" />
            <span>播放完整首歌后停止</span>
          </label>
        </div>

        <footer>
          <button v-if="isActive || isPaused" type="button" @click="isPaused ? emit('resume') : emit('pause')">
            {{ isPaused ? '继续计时' : '暂停计时' }}
          </button>
          <button v-else type="button" @click="emit('closeDialog')">取消</button>
          <button v-if="isActive || isPaused" type="button" @click="emit('clear')">取消定时</button>
          <button type="button" @click="emit('start')">确认开启</button>
        </footer>
      </div>
    </BaseDialog>
  </Teleport>
</template>

<style scoped>
.sleep-timer-control {
  position: relative;
  display: grid;
  place-items: center;
}

.sleep-timer-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 32px;
  height: 28px;
  padding: 0 7px;
  border: 0;
  border-radius: 7px;
  color: var(--smw-text-body);
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.sleep-timer-button:hover,
.sleep-timer-button:focus-visible {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
  outline: none;
}

.sleep-timer-button.is-active {
  color: #1677ff;
  background: color-mix(in srgb, #1677ff 12%, transparent);
}

.sleep-timer-button.is-active span {
  font-weight: 650;
}

.sleep-timer-status {
  position: absolute;
  right: -12px;
  bottom: 36px;
  z-index: 44;
  display: grid;
  gap: 10px;
  width: 282px;
  padding: 14px 12px 12px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-workspace);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.14);
}

.sleep-timer-status header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sleep-timer-status strong {
  color: var(--smw-text-primary);
  font-size: 14px;
}

.sleep-timer-status header button {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  padding: 0;
  border: 0;
  color: var(--smw-text-secondary);
  background: transparent;
  cursor: pointer;
}

.sleep-timer-status-progress {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, #1677ff 14%, transparent);
}

.sleep-timer-status-progress i {
  display: block;
  width: var(--timer-progress);
  height: 100%;
  border-radius: inherit;
  background: #1677ff;
}

.sleep-timer-status p {
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.sleep-timer-status-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.sleep-timer-status-actions button {
  height: 36px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 6px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-elevated);
  font: inherit;
  cursor: pointer;
}

.sleep-timer-status-actions button:last-child {
  color: #ef4444;
  border-color: #ef4444;
  background: transparent;
}

:global(.sleep-timer-dialog) {
  color: var(--smw-text-primary);
}

.sleep-timer-dialog-body {
  display: grid;
  gap: 18px;
  padding: 22px;
}

.sleep-timer-dialog-body footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sleep-timer-section-label {
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.sleep-timer-presets {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.sleep-timer-presets button {
  display: grid;
  min-height: 58px;
  place-items: center;
  padding: 8px 0;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-elevated);
  cursor: pointer;
}

.sleep-timer-presets button.is-active {
  color: #fff;
  border-color: var(--smw-button-primary);
  background: var(--smw-button-primary);
}

.sleep-timer-presets span {
  color: currentColor;
  font-size: 12px;
  opacity: 0.76;
}

.sleep-timer-or {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 24px;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.sleep-timer-or span {
  height: 1px;
  background: var(--smw-border-soft);
}

.sleep-timer-custom-time {
  display: flex;
  gap: 16px;
}

.sleep-timer-custom-time label {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.sleep-timer-custom-time input {
  width: 60px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-elevated);
  font: inherit;
  font-weight: 700;
  text-align: center;
}

.sleep-timer-custom-time input:focus {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
  outline: none;
}

.sleep-timer-action-options {
  display: grid;
  overflow: hidden;
  border-radius: 8px;
}

.sleep-timer-action-options label {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 0 12px;
  background: color-mix(in srgb, var(--smw-bg-selected) 36%, transparent);
  cursor: pointer;
}

.sleep-timer-action-options input {
  width: 18px;
  height: 18px;
  accent-color: var(--smw-button-primary);
}

.sleep-timer-dialog-body footer {
  gap: 12px;
}

.sleep-timer-dialog-body footer button {
  flex: 1;
  height: 46px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-elevated);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.sleep-timer-dialog-body footer button:last-child {
  color: #fff;
  border-color: var(--smw-button-primary);
  background: var(--smw-button-primary);
}

.sleep-timer-dialog-body footer button:last-child:hover {
  filter: brightness(0.96);
}
</style>
