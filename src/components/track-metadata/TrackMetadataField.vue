<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(defineProps<{
  autocomplete?: string;
  inputmode?: 'numeric';
  label: string;
  max?: string;
  min?: string;
  placeholder: string;
  required?: boolean;
  tokens?: string[];
  type?: 'number' | 'text';
  value: string;
  variant?: 'default' | 'pill';
}>(), {
  autocomplete: 'off',
  inputmode: undefined,
  max: undefined,
  min: undefined,
  required: false,
  tokens: () => [],
  type: 'text',
  variant: 'default',
});

const emit = defineEmits<{
  addToken: [value: string];
  removeToken: [index: number];
  update: [value: string];
}>();

const draftValue = ref('');

function inputValue(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  if (props.variant === 'pill') {
    draftValue.value = value;
    return;
  }

  emit('update', value);
}

function commitDraft() {
  const value = draftValue.value.trim();
  if (!value) return;
  emit('addToken', value);
  draftValue.value = '';
}

function handleKeydown(event: KeyboardEvent) {
  if (props.variant !== 'pill') return;

  if (['Enter', ',', '，', '/', ';', '；'].includes(event.key)) {
    event.preventDefault();
    commitDraft();
    return;
  }
}
</script>

<template>
  <div class="metadata-field" :class="{ 'is-pill': variant === 'pill' && tokens.length > 0 }">
    <span class="metadata-field-label" @mousedown.prevent @click.stop>{{ label }}</span>
    <span class="metadata-field-control">
      <template v-if="variant === 'pill' && tokens.length > 0">
        <span v-for="(token, index) in tokens" :key="`${token}-${index}`" class="metadata-field-pill">
          <span>{{ token }}</span>
          <button type="button" :aria-label="`移除${token}`" @click.prevent="emit('removeToken', index)">×</button>
        </span>
      </template>
      <input
        :value="variant === 'pill' ? draftValue : value"
        :type="type"
        :inputmode="inputmode"
        :min="min"
        :max="max"
        :autocomplete="autocomplete"
        :placeholder="variant === 'pill' && tokens.length > 0 ? '' : placeholder"
        :required="required"
        @blur="variant === 'pill' && commitDraft()"
        @input="inputValue"
        @keydown="handleKeydown"
      />
    </span>
  </div>
</template>

<style scoped>
.metadata-field {
  display: grid;
  gap: 6px;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.metadata-field-label {
  width: fit-content;
}

.metadata-field-control {
  position: relative;
  display: flex;
  align-items: center;
  height: 36px;
  min-width: 0;
  border: 1px solid var(--smw-border);
  border-radius: 7px;
  background: var(--smw-bg-input);
}

.metadata-field input {
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 0 12px;
  border: 0;
  outline: none;
  color: var(--smw-text-primary);
  background: transparent;
  font: inherit;
}

.metadata-field input:focus,
.metadata-field input:focus-visible {
  border: 0;
  outline: none;
  box-shadow: none;
}

.metadata-field-control:focus-within {
  border-color: var(--smw-border-strong);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 12%, transparent);
}

.metadata-field.is-pill .metadata-field-control {
  gap: 6px;
  padding: 5px 8px;
  flex-wrap: wrap;
  overflow: visible;
}

.metadata-field.is-pill input {
  flex: 0 1 80px;
  width: auto;
  min-width: 18px;
  max-width: 120px;
  height: 22px;
  padding: 0 4px;
  border: 0;
  outline: none;
  background: transparent;
  box-shadow: none;
  appearance: none;
}

.metadata-field-pill {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  height: 22px;
  padding: 0 8px;
  overflow: visible;
  border: 1px solid color-mix(in srgb, var(--smw-button-primary) 30%, var(--smw-border));
  border-radius: 999px;
  color: color-mix(in srgb, var(--smw-button-primary) 84%, var(--smw-text-primary));
  background: color-mix(in srgb, var(--smw-button-primary) 10%, var(--smw-bg-selected));
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metadata-field-pill span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metadata-field-pill button {
  all: unset;
  position: absolute;
  top: -7px;
  right: -7px;
  display: grid;
  width: 15px;
  height: 15px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--smw-text-secondary) 18%, var(--smw-bg-input));
  border-radius: 999px;
  color: var(--smw-text-secondary);
  background: color-mix(in srgb, var(--smw-bg-input) 94%, var(--smw-text-secondary));
  box-shadow: 0 1px 3px color-mix(in srgb, var(--smw-text-primary) 10%, transparent);
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  transition: opacity 140ms ease;
}

.metadata-field-pill:hover button,
.metadata-field-pill:focus-within button {
  color: var(--smw-text-primary);
  border-color: color-mix(in srgb, var(--smw-text-secondary) 28%, var(--smw-bg-input));
  background: var(--smw-bg-input);
  opacity: 1;
  pointer-events: auto;
}

.metadata-field-pill button:hover,
.metadata-field-pill button:focus-visible {
  color: currentColor;
  outline: none;
  opacity: 1;
}
</style>
