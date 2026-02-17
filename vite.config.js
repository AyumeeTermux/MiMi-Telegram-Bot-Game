import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on all addresses (0.0.0.0)
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    allowedHosts: true // Allow all hosts (for ngrok/tunnels/cloud domains)
  },
  preview: {
    host: true,
    port: process.env.PORT ? parseInt(process.env.PORT) : 4173,
    allowedHosts: true
  }
})