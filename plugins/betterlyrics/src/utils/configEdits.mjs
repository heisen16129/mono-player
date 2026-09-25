// SPDX-License-Identifier: GPL-3.0-only
import { configWithDefaults } from '../state.mjs';

// Keep local input until the host acknowledges the committed value.
export function createConfigEdits() {
  const pending = new Map(), editing = new Set();
  return {
    preview(patch) {
      for (const [key, value] of Object.entries(patch)) {
        pending.set(key, value); editing.add(key);
      }
    },
    commit(patch) {
      for (const [key, value] of Object.entries(patch)) {
        pending.set(key, value); editing.delete(key);
      }
    },
    receive(config) {
      const result = configWithDefaults(config);
      for (const [key, value] of pending) {
        if (!editing.has(key) && result[key] === value) pending.delete(key);
        else result[key] = value;
      }
      return result;
    },
    isEditing(key) { return editing.has(key); },
  };
}
