import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: fileURLToPath(new URL('./ui/src', import.meta.url)), base: './', plugins: [vue()], build: { outDir: '../dist', emptyOutDir: true } });
