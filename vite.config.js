import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single IIFE bundle: content scripts can't load ES modules.
// manifest.json + background.js + stickers/ ride along from public/ untouched.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/content.jsx',
      output: { format: 'iife', entryFileNames: 'content.js', assetFileNames: '[name][extname]' },
    },
  },
})
