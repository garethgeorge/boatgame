import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Use relative paths for assets to ensure they load on GitHub Pages
  build: {
    outDir: 'dist',
  }
});
