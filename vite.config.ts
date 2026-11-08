import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { watch: { usePolling: true, interval: 500, ignored: ['**/.qa-*/**','**/assets-src/**','**/artifacts/**','**/__pycache__/**','**/*.blend*'] } },
  build: {
    chunkSizeWarningLimit: 850,
    rollupOptions: { output: { manualChunks: { 'three-runtime': ['three'] } } },
  },
})
