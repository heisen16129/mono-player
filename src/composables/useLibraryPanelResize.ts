import { computed, onBeforeUnmount, ref } from 'vue';
import { readPersistentValue, writePersistentValue } from '../services/persistentStore';

const LIBRARY_PANEL_WIDTH_KEY = 'layout.libraryPanelWidth';
const MIN_LIBRARY_PANEL_WIDTH = 220;
const MAX_LIBRARY_PANEL_WIDTH = 260;
const COLLAPSED_PANEL_DRAG_THRESHOLD = 20;
const COLLAPSE_PUSH_DISTANCE = 64;

export function useLibraryPanelResize() {
  const libraryPanelWidth = ref(260);
  const displayedWidth = ref(260);
  const isResizingLibraryPanel = ref(false);
  let libraryPanelResizeStartX = 0;
  let libraryPanelResizeStartWidth = 0;
  let minimumReachedX: number | undefined;
  let animationFrame = 0;

  function setWidth(width: number, animated = false) {
    libraryPanelWidth.value = width;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    if (!animated || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      displayedWidth.value = width;
      return;
    }
    const from = displayedWidth.value;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - started) / 240));
      displayedWidth.value = from + (width - from) * (1 - (1 - progress) ** 3);
      animationFrame = progress < 1 ? requestAnimationFrame(tick) : 0;
    };
    animationFrame = requestAnimationFrame(tick);
  }

  const appGridStyle = computed(() => ({
    '--library-width': `${displayedWidth.value}px`,
    '--library-panel-visibility': displayedWidth.value === 0 ? 'hidden' : 'visible',
  }));

  function clampLibraryPanelWidth(width: number) {
    return Math.min(MAX_LIBRARY_PANEL_WIDTH, Math.max(MIN_LIBRARY_PANEL_WIDTH, Math.round(width)));
  }

  async function loadLibraryPanelWidth() {
    const storedWidth = await readPersistentValue<number>(LIBRARY_PANEL_WIDTH_KEY);
    if (typeof storedWidth === 'number' && Number.isFinite(storedWidth)) {
      setWidth(storedWidth === 0 ? 0 : clampLibraryPanelWidth(storedWidth));
    }
  }

  function startLibraryPanelResize(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    libraryPanelResizeStartX = event.clientX;
    libraryPanelResizeStartWidth = libraryPanelWidth.value;
    minimumReachedX = libraryPanelWidth.value === MIN_LIBRARY_PANEL_WIDTH ? event.clientX : undefined;
    isResizingLibraryPanel.value = true;
    document.body.classList.add('is-resizing-library-panel');
    window.addEventListener('pointermove', resizeLibraryPanel);
    window.addEventListener('pointerup', stopLibraryPanelResize, { once: true });
  }

  function resizeLibraryPanel(event: PointerEvent) {
    if (!isResizingLibraryPanel.value) return;
    const delta = event.clientX - libraryPanelResizeStartX;
    if (libraryPanelResizeStartWidth === 0) {
      if (delta < COLLAPSED_PANEL_DRAG_THRESHOLD) return;
      setWidth(MIN_LIBRARY_PANEL_WIDTH, true);
      libraryPanelResizeStartWidth = MIN_LIBRARY_PANEL_WIDTH;
      libraryPanelResizeStartX = event.clientX;
      minimumReachedX = event.clientX;
      return;
    }
    const width = libraryPanelResizeStartWidth + delta;
    if (width <= MIN_LIBRARY_PANEL_WIDTH) {
      minimumReachedX ??= event.clientX;
      if (minimumReachedX - event.clientX >= COLLAPSE_PUSH_DISTANCE) {
        setWidth(0, true);
        libraryPanelResizeStartWidth = 0;
        libraryPanelResizeStartX = event.clientX;
        minimumReachedX = undefined;
      } else if (libraryPanelWidth.value !== MIN_LIBRARY_PANEL_WIDTH) {
        setWidth(MIN_LIBRARY_PANEL_WIDTH);
      }
      return;
    }
    minimumReachedX = undefined;
    setWidth(clampLibraryPanelWidth(width), animationFrame !== 0);
  }

  function stopLibraryPanelResize() {
    if (!isResizingLibraryPanel.value) return;
    isResizingLibraryPanel.value = false;
    document.body.classList.remove('is-resizing-library-panel');
    window.removeEventListener('pointermove', resizeLibraryPanel);
    void writePersistentValue(LIBRARY_PANEL_WIDTH_KEY, libraryPanelWidth.value);
  }

  onBeforeUnmount(() => {
    stopLibraryPanelResize();
    cancelAnimationFrame(animationFrame);
  });

  return {
    appGridStyle,
    isResizingLibraryPanel,
    loadLibraryPanelWidth,
    startLibraryPanelResize,
  };
}
