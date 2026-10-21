import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import JSZip from 'jszip'
import { readFile } from 'node:fs/promises'

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const INFORME = path.join(FIXTURES, 'CF-2024-G-101 informe.pdf')
const PESADO = path.join(FIXTURES, 'pesado.pdf')

test.describe('Preparar para Hacienda', () => {
  test('se sueltan varios PDF, empiezan solos y sale un zip con partes y recetas', async ({ page }) => {
    await page.goto('/')
    await page.locator('.toolbtn').filter({ hasText: /^Preparar para Hacienda/ }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Preparar para Hacienda')

    // Un solo gesto: soltar los archivos. No hay nada que configurar.
    await page.locator('.drop input[type=file]').setInputFiles([INFORME, PESADO])
    await expect(page.locator('.hacienda-item[data-estado=listo]')).toHaveCount(2, { timeout: 60_000 })
    await expect(page.locator('.banner')).toContainText('2 documentos listos')

    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Descargar todo/ }).click(),
    ])
    expect(descarga.suggestedFilename()).toBe('listos_para_hacienda.zip')
    const zip = await JSZip.loadAsync(await readFile(await descarga.path()))
    const nombres = Object.keys(zip.files)
    expect(nombres).toContain('recetas/pesado_receta.txt')
    expect(nombres.filter((n) => n.endsWith('.pdf') && !n.startsWith('recetas/')).length).toBeGreaterThanOrEqual(2)

    // La receta se puede leer ahí mismo
    await page.getByRole('button', { name: 'Ver receta' }).first().click()
    await expect(page.locator('.receta').first()).toContainText('Receta de NahualPDF')
  })
})
