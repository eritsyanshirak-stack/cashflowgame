import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative assets keep standalone preview builds playable from GitHub/CDN subpaths.
export default defineConfig({
  base: './',
  plugins: [react()],
})
