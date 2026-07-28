import { defineConfig } from '@playwright/test'

/**
 * QA de interfaz contra la app corriendo en local. Usa el Chrome instalado en
 * el servidor (channel: 'chrome'), así no hay que descargar navegadores.
 *
 * Por defecto apunta al servidor de desarrollo de Vite (:5173) y requiere el
 * backend arriba en :8000. Para probar contra el servicio instalado, que sirve
 * el build compilado desde FastAPI:
 *   NAHUALPDF_URL=http://localhost:8000 npx playwright test e2e/nahualpdf.spec.ts
 */
const BASE_URL = process.env.NAHUALPDF_URL ?? 'http://localhost:5173'
const USA_VITE = BASE_URL.includes('5173')

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--no-sandbox'] },
  },
  // Solo se levanta Vite cuando se prueba contra él; si se apunta al servicio
  // instalado, ese ya está corriendo por systemd.
  webServer: USA_VITE
    ? { command: 'npm run dev', url: BASE_URL, reuseExistingServer: true, timeout: 60_000 }
    : undefined,
})
