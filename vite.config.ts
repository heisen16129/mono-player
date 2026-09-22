import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: {
    strictPort: true,
    port: 1420,
    watch: {
      // Keep Rust build trees and reference projects out of the initial file scan.
      ignored: [
        '**/target/**',
        '**/target-*/**',
        '**/.cargo-check-target/**',
        '**/.reference/**',
        '**/.history/**',
        '**/.uploads/**',
      ],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
