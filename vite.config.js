import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        notFound: './404.html',
        offline: './offline.html'
      }
    }
  }
});
