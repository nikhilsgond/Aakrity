// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, 'src/app'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    host: '0.0.0.0', // Listen on all network interfaces [citation:1][citation:7]
    port: 5173,       // Your dev server port
    strictPort: true, // Optional: exit if port is taken
    allowedHosts: [   // Add any hostnames you might use
      '.localhost',
      '127.0.0.1',
      '.local',       // For .local domains on some networks
    ],
    // Add this for better network compatibility
    watch: {
      usePolling: true, // Helps with some network setups
    },
  },
})
