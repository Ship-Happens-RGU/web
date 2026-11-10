import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: [
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
      {
        find: /^@blueprintjs\/icons$/,
        replacement: fileURLToPath(new URL('./node_modules/@blueprintjs/icons/lib/esm/generated/index.js', import.meta.url)),
      },
      {
        find: /^@blueprintjs\/icons\/next$/,
        replacement: fileURLToPath(new URL('./node_modules/@blueprintjs/icons/lib/esm/next/generated/index.js', import.meta.url)),
      },
    ],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/actuator': 'http://localhost:8080',
    },
  },
})
