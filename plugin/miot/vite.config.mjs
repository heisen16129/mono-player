import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({ root: 'ui/frontend', base: './', plugins: [vue({ template: { compilerOptions: { isCustomElement: tag => /^(flutter-|webf-|songloft-)/.test(tag) } } })], build: { outDir: '../dist', emptyOutDir: true } });
