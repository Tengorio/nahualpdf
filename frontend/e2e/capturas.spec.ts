import { test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * No es una prueba con aserciones: genera capturas de cada pantalla en tema
 * claro y oscuro para revisarlas a ojo. Correr con:
 *   npx playwright test e2e/capturas.spec.ts
 * Las imágenes quedan en e2e/capturas/ (fuera de git).
 */
const DIR = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.join(DIR, 'fixtures')
const OUT = path.join(DIR, 'capturas')
const INFORME = path.join(FIXTURES, 'CF-2024-G-101 informe.pdf')
const ANEXO = path.join(FIXTURES, 'CF-2024-G-101 anexo.pdf')

async function tema(page: Page, modo: 'light' | 'dark') {
  await page.goto('/')
  const actual = await page.locator('html').getAttribute('data-theme')
  if (actual !== modo) await page.getByRole('button', { name: 'Cambiar tema' }).click()
}

async function abrir(page: Page, herramienta: string) {
  await page.goto('/')
  await page.locator('.toolbtn').filter({ hasText: new RegExp(`^${herramienta}`) }).click()
}

for (const modo of ['light', 'dark'] as const) {
  test(`capturas ${modo}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await tema(page, modo)

    for (const tool of ['Reorganizar', 'Dividir', 'Comprimir']) {
      await abrir(page, tool)
      await page.screenshot({ path: path.join(OUT, `${modo}-${tool.toLowerCase()}-inicio.png`) })
    }

    // Tablero de Reorganizar con páginas cargadas y un giro aplicado.
    await abrir(page, 'Reorganizar')
    await page.locator('.drop input[type=file]').setInputFiles([INFORME, ANEXO])
    await page.locator('.pcard').first().waitFor()
    await page.locator('.pcard').first().getByTitle(/Girar 90/).click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(OUT, `${modo}-reorganizar-tablero.png`), fullPage: true })

    // Resultado de reorganizar.
    await page.getByRole('button', { name: /Guardar \d+ página/ }).click()
    await page.locator('.banner').waitFor({ timeout: 60_000 })
    await page.waitForTimeout(900)
    await page.screenshot({ path: path.join(OUT, `${modo}-reorganizar-resultado.png`), fullPage: true })

    // Tablero pequeño en Reorganizar (densidad máxima).
    await abrir(page, 'Reorganizar')
    await page.locator('.drop input[type=file]').setInputFiles([INFORME, ANEXO])
    await page.locator('.pcard').first().waitFor()
    await page.getByRole('button', { name: 'S', exact: true }).click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(OUT, `${modo}-reorganizar-tablero-sm.png`), fullPage: true })
  })
}
