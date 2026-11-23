import { defineConfig } from 'vite';

export default defineConfig({
  base:'./',
  build:{
    rollupOptions:{
      output:{
        manualChunks(id) {
          if (id.includes('node_modules/@codemirror/view/') || id.includes('node_modules/@codemirror/state/')) return 'editor';
        }
      }
    }
  }
});
