import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The Express API (server/) runs on :4100 in development.
  server: { proxy: { '/api': 'http://localhost:4100' } },
})
