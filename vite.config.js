import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        painel: './painel-klns-zy-26-x9.html',
        notFound: './404.html',
        offline: './offline.html'
      }
    }
  }
});
