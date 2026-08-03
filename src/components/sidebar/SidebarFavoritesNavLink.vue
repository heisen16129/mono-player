<script setup lang="ts">
import { Heart } from '@lucide/vue';
import { t } from '../../i18n';
import type { SidebarFavoritesNavLinkEmits, SidebarFavoritesNavLinkProps } from '../../types/sidebar';
import SidebarMainNavLink from './SidebarMainNavLink.vue';

defineProps<SidebarFavoritesNavLinkProps>();

const emit = defineEmits<SidebarFavoritesNavLinkEmits>();
</script>

<template>
  <SidebarMainNavLink
    :collapsed="collapsed"
    href="#favorites"
    :is-active="active"
    :title="t(locale, 'favorites')"
    @navigate="emit('openFavorites')"
  >
    <template #icon><Heart :size="22" /></template>
  </SidebarMainNavLink>
</template>
