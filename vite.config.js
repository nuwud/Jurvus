import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 4200,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3210',
        changeOrigin: true,
      },
    },
  },
  assetsInclude: ['**/*.glb', '**/*.gltf'],
});
