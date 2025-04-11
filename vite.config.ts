import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  base: '/', // Ensure assets are loaded from the correct base path
  server: {
    // Configure server to handle MIME types correctly
    fs: {
      strict: true,
    },
    hmr: {
      overlay: true,
    },
  },
});