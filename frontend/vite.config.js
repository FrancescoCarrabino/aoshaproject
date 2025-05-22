import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { // Your API calls
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/uploads': { // For serving static uploaded files from backend
        target: 'http://localhost:5001',
        changeOrigin: true,
      }
    }
  }
})
