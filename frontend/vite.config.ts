import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'

const version = (() => {
  try {
    return execSync('git describe --tags --always --dirty', { encoding: 'utf8' }).trim()
  } catch {
    // Docker build: no .git in context
    return 'dev'
  }
})()

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
