import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: './', // Use relative paths for assets to ensure they load on GitHub Pages
  plugins: [
    basicSsl()
  ],
  server: {
    host: true // Exposes the server to the network (0.0.0.0)
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: '/index.html',
        designer: '/designer.html',
        'biome-designer': '/biome-designer.html',
        'metadata-extractor': '/metadata-extractor.html'
      }
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  }
});
