import { computed, onBeforeUnmount, ref } from 'vue';
import { readPersistentValue, writePersistentValue } from '../services/persistentStore';

const LIBRARY_PANEL_WIDTH_KEY = 'layout.libraryPanelWidth';
const MIN_LIBRARY_PANEL_WIDTH = 220;
const MAX_LIBRARY_PANEL_WIDTH = 260;

export function useLibraryPanelResize() {
  const libraryPanelWidth = ref(260);
  const isResizingLibraryPanel = ref(false);
  let libraryPanelResizeStartX = 0;
  let libraryPanelResizeStartWidth = 0;

  const appGridStyle = computed(() => ({
    '--library-width': `${libraryPanelWidth.value}px`,
  }));

  function clampLibraryPanelWidth(width: number) {
    return Math.min(MAX_LIBRARY_PANEL_WIDTH, Math.max(MIN_LIBRARY_PANEL_WIDTH, Math.round(width)));
  }

  async function loadLibraryPanelWidth() {
    const storedWidth = await readPersistentValue<number>(LIBRARY_PANEL_WIDTH_KEY);
    if (typeof storedWidth === 'number' && Number.isFinite(storedWidth)) {
      libraryPanelWidth.value = clampLibraryPanelWidth(storedWidth);
    }
  }

  function startLibraryPanelResize(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    libraryPanelResizeStartX = event.clientX;
    libraryPanelResizeStartWidth = libraryPanelWidth.value;
    isResizingLibraryPanel.value = true;
    document.body.classList.add('is-resizing-library-panel');
    window.addEventListener('pointermove', resizeLibraryPanel);
    window.addEventListener('pointerup', stopLibraryPanelResize, { once: true });
  }

  function resizeLibraryPanel(event: PointerEvent) {
    if (!isResizingLibraryPanel.value) return;
    libraryPanelWidth.value = clampLibraryPanelWidth(libraryPanelResizeStartWidth + event.clientX - libraryPanelResizeStartX);
  }

  function stopLibraryPanelResize() {
    if (!isResizingLibraryPanel.value) return;
    isResizingLibraryPanel.value = false;
    document.body.classList.remove('is-resizing-library-panel');
    window.removeEventListener('pointermove', resizeLibraryPanel);
    void writePersistentValue(LIBRARY_PANEL_WIDTH_KEY, libraryPanelWidth.value);
  }

  onBeforeUnmount(stopLibraryPanelResize);

  return {
    appGridStyle,
    isResizingLibraryPanel,
    loadLibraryPanelWidth,
    startLibraryPanelResize,
  };
}
