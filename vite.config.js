import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: './', // Use relative paths for assets to ensure they load on GitHub Pages
  plugins: [
    basicSsl()
  ],
  build: {
    outDir: 'dist',
  },
  server: {
    host: true // Exposes the server to the network (0.0.0.0)
  }
});
