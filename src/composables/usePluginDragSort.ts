import { onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue';
import { saveInstalledPlugins } from '../services/plugins';
import type { PluginManifest } from '../types/plugin';
import type { PluginRow } from '../components/plugin-manager/types';

interface UsePluginDragSortOptions {
  installedPlugins: Ref<PluginManifest[]>;
  notify: (message: string) => void;
  visiblePlugins: ComputedRef<PluginRow[]>;
}

export function usePluginDragSort({ installedPlugins, notify, visiblePlugins }: UsePluginDragSortOptions) {
  const draggingPluginId = ref<string | null>(null);
  const dragOverPluginId = ref<string | null>(null);
  const hasPendingPluginOrderChange = ref(false);

  function startPluginPointerDrag(event: PointerEvent, plugin: PluginRow) {
    if (!plugin.installed || !plugin.manifest) return;

    event.preventDefault();
    event.stopPropagation();
    draggingPluginId.value = plugin.id;
    dragOverPluginId.value = plugin.id;
    hasPendingPluginOrderChange.value = false;
    window.addEventListener('pointermove', handlePluginPointerMove);
    window.addEventListener('pointerup', finishPluginPointerDrag, { once: true });
    window.addEventListener('pointercancel', cancelPluginPointerDrag, { once: true });
  }

  function startPluginRowPointerDrag(event: PointerEvent, plugin: PluginRow) {
    if (!plugin.installed || !plugin.manifest) return;
    if (event.button !== 0) return;

    const target = event.target;
    if (
      target instanceof HTMLElement
      && target.closest('button, input, a, select, textarea, .row-actions')
    ) {
      return;
    }

    startPluginPointerDrag(event, plugin);
  }

  function handlePluginPointerMove(event: PointerEvent) {
    if (!draggingPluginId.value) return;

    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLTableRowElement>('[data-plugin-id]');
    const pluginId = row?.dataset.pluginId;
    if (!pluginId) return;

    const plugin = visiblePlugins.value.find((item) => item.id === pluginId);
    if (plugin) moveDraggedPluginTo(plugin);
  }

  function moveDraggedPluginTo(plugin: PluginRow) {
    const sourceId = draggingPluginId.value;
    if (!sourceId || !plugin.installed || sourceId === plugin.id) return;

    const sourceIndex = installedPlugins.value.findIndex((item) => item.id === sourceId);
    const targetIndex = installedPlugins.value.findIndex((item) => item.id === plugin.id);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const nextInstalledPlugins = [...installedPlugins.value];
    const [movedPlugin] = nextInstalledPlugins.splice(sourceIndex, 1);
    nextInstalledPlugins.splice(targetIndex, 0, movedPlugin);
    installedPlugins.value = nextInstalledPlugins;
    dragOverPluginId.value = plugin.id;
    hasPendingPluginOrderChange.value = true;
  }

  async function finishPluginPointerDrag() {
    if (hasPendingPluginOrderChange.value) {
      await saveInstalledPlugins(installedPlugins.value);
      notify('插件排序已保存');
    }

    resetPluginPointerDragState();
  }

  function cancelPluginPointerDrag() {
    resetPluginPointerDragState();
  }

  function resetPluginPointerDragState() {
    window.removeEventListener('pointermove', handlePluginPointerMove);
    window.removeEventListener('pointerup', finishPluginPointerDrag);
    window.removeEventListener('pointercancel', cancelPluginPointerDrag);
    draggingPluginId.value = null;
    dragOverPluginId.value = null;
    hasPendingPluginOrderChange.value = false;
  }

  onBeforeUnmount(resetPluginPointerDragState);

  return {
    dragOverPluginId,
    draggingPluginId,
    resetPluginPointerDragState,
    startPluginPointerDrag,
    startPluginRowPointerDrag,
  };
}
