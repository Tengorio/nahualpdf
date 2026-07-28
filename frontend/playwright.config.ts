import { defineConfig } from '@playwright/test'

/**
 * QA de interfaz contra la app corriendo en local. Usa el Chrome instalado en
 * el servidor (channel: 'chrome'), así no hay que descargar navegadores.
 *
 * Requiere el backend arriba en :8000 — el webServer de abajo solo levanta Vite.
 *   conda activate mini && cd ../backend && uvicorn app.main:app --port 8000
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--no-sandbox'] },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
