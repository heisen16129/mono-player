import type { ShortcutAction } from '../types/music';

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);
const KEY_LABELS: Record<string, string> = {
  ' ': 'Space',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  Escape: 'Esc',
  Delete: 'Del',
};

export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  'togglePlayback',
  'nextTrack',
  'previousTrack',
  'volumeUp',
  'volumeDown',
  'toggleDesktopLyrics',
  'toggleFavorite',
  'togglePlaybackMode',
];

export function shortcutFromKeyboardEvent(event: KeyboardEvent) {
  if (MODIFIER_KEYS.has(event.key)) return '';

  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');

  const key = KEY_LABELS[event.key] ?? normalizeKey(event.key);
  if (!key) return '';
  parts.push(key);
  return parts.join('+');
}

export function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

export function normalizeShortcutValue(value: string) {
  return value.trim().toLocaleLowerCase();
}

function normalizeKey(key: string) {
  if (key.length === 1) return key.toLocaleUpperCase();
  return key;
}
