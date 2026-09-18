import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:8000',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'cd ../backend && poetry run uvicorn app.main:app --port 8000',
    port: 8000,
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
