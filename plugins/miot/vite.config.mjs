import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({ root: 'frontend', base: '/static/', plugins: [vue({ template: { compilerOptions: { isCustomElement: tag => /^(flutter-|webf-|songloft-)/.test(tag) } } })], build: { outDir: '../dist/web', emptyOutDir: true } });
