import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [svelte()],
  root: __dirname,
  base: mode === 'development' ? '/' : '/static/',
  publicDir: resolve(__dirname, 'public'),
  resolve: {
    alias: {
      $components: resolve(__dirname, 'src/components'),
      $lib: resolve(__dirname, 'src/lib'),
      $routes: resolve(__dirname, 'src/routes'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        advanced: resolve(__dirname, 'advanced.html'),
        esoteric: resolve(__dirname, 'esoteric.html'),
        education: resolve(__dirname, 'education.html'),
        '401': resolve(__dirname, '401.html'),
      },
    },
  },
  server: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
}));
