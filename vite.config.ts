import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5179,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Vite 8 is Rolldown-based: manualChunks must be a function
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('three-stdlib') || id.includes('/three/')) return 'three'
            if (id.includes('@react-three') || id.includes('postprocessing') || id.includes('troika')) return 'r3f'
            return 'vendor'
          }
        },
      },
    },
  },
})
