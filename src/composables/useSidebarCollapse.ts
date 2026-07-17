import { onBeforeUnmount, onMounted, ref } from 'vue';

const SIDEBAR_AUTO_COLLAPSE_WIDTH = 1220;
const SIDEBAR_AUTO_EXPAND_WIDTH = 1320;

export function useSidebarCollapse() {
  const isSidebarCollapsed = ref(false);

  function updateSidebarCollapsedForWindowWidth() {
    const width = window.innerWidth;
    if (width < SIDEBAR_AUTO_COLLAPSE_WIDTH) {
      isSidebarCollapsed.value = true;
      return;
    }

    if (width > SIDEBAR_AUTO_EXPAND_WIDTH) {
      isSidebarCollapsed.value = false;
    }
  }

  onMounted(() => {
    updateSidebarCollapsedForWindowWidth();
    window.addEventListener('resize', updateSidebarCollapsedForWindowWidth);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateSidebarCollapsedForWindowWidth);
  });

  return {
    isSidebarCollapsed,
    updateSidebarCollapsedForWindowWidth,
  };
}
