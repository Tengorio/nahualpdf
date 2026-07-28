import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const INFORME = path.join(FIXTURES, 'CF-2024-G-101 informe.pdf') // 4 páginas, con texto
const ANEXO = path.join(FIXTURES, 'CF-2024-G-101 anexo.pdf') // 3 páginas, con texto
const PESADO = path.join(FIXTURES, 'pesado.pdf') // 3 páginas, sin texto, ~670 KB

/**
 * Abre una herramienta del menú lateral. El nombre accesible del botón incluye
 * su subtítulo ("Unir Combinar y comprimir"), así que se ancla al inicio para
 * que buscar "Comprimir" no caiga en el botón de Unir.
 */
async function abrir(page: Page, herramienta: string) {
  await page.goto('/')
  await page.locator('.toolbtn').filter({ hasText: new RegExp(`^${herramienta}`) }).click()
}

/** Sube archivos por el input oculto de la zona de arrastre. */
async function subir(page: Page, archivos: string | string[]) {
  await page.locator('.drop input[type=file]').setInputFiles(archivos)
}

/** Descarga disparada por un botón, devuelve el nombre sugerido. */
async function descargarCon(page: Page, boton: ReturnType<Page['getByRole']>) {
  const [download] = await Promise.all([page.waitForEvent('download'), boton.click()])
  return download.suggestedFilename()
}

test.describe('Navegación y apariencia', () => {
  test('las cuatro herramientas cargan su panel', async ({ page }) => {
    await page.goto('/')
    for (const [tool, titulo] of [
      ['Dividir', 'Dividir un expediente'],
      ['Unir', 'Unir expedientes'],
      ['Comprimir', /Comprimir/],
      ['Organizar', 'Organizar páginas'],
    ] as const) {
      await page.locator('.toolbtn').filter({ hasText: new RegExp(`^${tool}`) }).click()
      await expect(page.getByRole('heading', { level: 1 })).toContainText(titulo)
    }
  })

  test('el tema arranca en claro y el botón lo alterna', async ({ page }) => {
    await page.goto('/')
    const root = page.locator('html')
    await expect(root).toHaveAttribute('data-theme', 'light')
    await page.getByRole('button', { name: 'Cambiar tema' }).click()
    await expect(root).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(root).toHaveAttribute('data-theme', 'dark') // se recuerda
  })

  test('no hay errores de consola al arrancar', async ({ page }) => {
    const errores: string[] = []
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()) })
    await page.goto('/')
    await page.waitForTimeout(1000)
    expect(errores).toEqual([])
  })
})

test.describe('Dividir', () => {
  test('modo automático parte un PDF pesado y ofrece el zip', async ({ page }) => {
    await abrir(page, 'Dividir')
    await subir(page, PESADO)
    await expect(page.locator('.docbar')).toContainText('3 páginas')

    await page.locator('.ctl .num').first().fill('0.2')
    await page.getByRole('button', { name: /^Dividir$/ }).click()

    await expect(page.locator('.banner')).toContainText(/archivo\(s\)/, { timeout: 60_000 })
    const tarjetas = page.locator('.rcard')
    expect(await tarjetas.count()).toBeGreaterThan(1)

    const nombre = await descargarCon(page, page.getByRole('button', { name: /Descargar todo/ }))
    expect(nombre).toMatch(/\.zip$/)
  })

  test('modo manual respeta los rangos y nombra con la clave del proyecto', async ({ page }) => {
    await abrir(page, 'Dividir')
    await subir(page, INFORME)
    await expect(page.locator('.docbar')).toContainText('clave CF-2024-G-101')

    await page.getByRole('button', { name: 'Manual' }).click()
    const campos = page.locator('.rfield input')
    await expect(campos).toHaveCount(2)
    await campos.nth(0).fill('1-3')
    await campos.nth(1).fill('4')
    await page.getByRole('button', { name: /^Dividir$/ }).click()

    await expect(page.locator('.rcard')).toHaveCount(2)
    const nombre = await descargarCon(page, page.getByRole('button', { name: 'Descargar 1' }))
    expect(nombre).toBe('CF-2024-G-101_1.pdf')
  })

  test('un rango inválido se reporta sin tumbar el resto', async ({ page }) => {
    await abrir(page, 'Dividir')
    await subir(page, INFORME)
    await page.getByRole('button', { name: 'Manual' }).click()
    await page.locator('.rfield input').nth(1).fill('99-120')
    await page.getByRole('button', { name: /^Dividir$/ }).click()

    await expect(page.locator('.banner')).toContainText('inválido')
    await expect(page.locator('.rcard')).toHaveCount(1)
  })
})

test.describe('Comprimir', () => {
  test('reduce el peso y permite descargar', async ({ page }) => {
    await abrir(page, 'Comprimir')
    await subir(page, PESADO)
    await expect(page.locator('.docbar')).toContainText('3 páginas')
    await page.locator('.actionbar').getByRole('button', { name: /^Comprimir$/ }).click()

    await expect(page.locator('.banner')).toBeVisible({ timeout: 60_000 })
    const nombre = await descargarCon(page, page.getByRole('button', { name: /Descargar/ }).first())
    expect(nombre).toMatch(/\.pdf$/)
  })
})

test.describe('Unir', () => {
  test('muestra las páginas de varios PDF y las une en el orden del tablero', async ({ page }) => {
    await abrir(page, 'Unir')
    await subir(page, [INFORME, ANEXO])

    // 4 + 3 páginas, cada una con su miniatura renderizada.
    await expect(page.locator('.pcard')).toHaveCount(7)
    await expect(page.locator('.board-toolbar')).toContainText('7 de 7')
    await expect(page.locator('.pcard').first().locator('canvas')).toHaveJSProperty('width', 180)

    // Excluir una página baja la cuenta y renumera.
    await page.locator('.pcard').first().getByTitle('Excluir página').click()
    await expect(page.locator('.board-toolbar')).toContainText('6 de 7')
    await expect(page.locator('.pcard').first()).toHaveClass(/excluded/)

    await page.getByRole('button', { name: /Unir 6 página/ }).click()
    await expect(page.locator('.banner')).toContainText('6 páginas', { timeout: 60_000 })

    const nombre = await descargarCon(page, page.getByRole('button', { name: /Descargar/ }).first())
    expect(nombre).toBe('CF-2024-G-101_DC.pdf')
  })

  test('arrastrar una miniatura la reubica en el orden', async ({ page }) => {
    await abrir(page, 'Unir')
    await subir(page, INFORME)
    await expect(page.locator('.pcard')).toHaveCount(4)

    const orden = () => page.locator('.pcard-foot .pg').allTextContents()
    expect(await orden()).toEqual(['p.1', 'p.2', 'p.3', 'p.4'])

    // Arrastra la primera tarjeta sobre la tercera. dnd-kit necesita que el
    // puntero se mueva en pasos para disparar el sensor (distancia mínima 5px).
    const origen = await page.locator('.pcard').nth(0).boundingBox()
    const destino = await page.locator('.pcard').nth(2).boundingBox()
    if (!origen || !destino) throw new Error('no se pudieron ubicar las tarjetas')

    await page.mouse.move(origen.x + origen.width / 2, origen.y + origen.height / 2)
    await page.mouse.down()
    await page.mouse.move(destino.x + destino.width / 2, destino.y + destino.height / 2, { steps: 12 })
    await page.mouse.up()

    expect(await orden()).toEqual(['p.2', 'p.3', 'p.1', 'p.4'])
    // La numeración visible se recalcula tras el movimiento.
    expect(await page.locator('.pcard .ord').allTextContents()).toEqual(['1', '2', '3', '4'])
  })

  test('invertir el orden reordena el tablero', async ({ page }) => {
    await abrir(page, 'Unir')
    await subir(page, INFORME)
    await expect(page.locator('.pcard')).toHaveCount(4)
    const etiquetas = () => page.locator('.pcard-foot .pg').allTextContents()
    expect(await etiquetas()).toEqual(['p.1', 'p.2', 'p.3', 'p.4'])

    await page.getByRole('button', { name: 'Invertir orden' }).click()
    expect(await etiquetas()).toEqual(['p.4', 'p.3', 'p.2', 'p.1'])
  })
})

test.describe('Organizar', () => {
  test('gira, reordena y guarda el documento', async ({ page }) => {
    await abrir(page, 'Organizar')
    await subir(page, INFORME)
    await expect(page.locator('.pcard')).toHaveCount(4)

    // Girar la primera página dos veces = 180°, con su distintivo visible.
    const primera = page.locator('.pcard').first()
    await primera.getByTitle(/Girar 90/).click()
    await expect(primera.locator('.rotbadge')).toHaveText('90°')
    await primera.getByTitle(/Girar 90/).click()
    await expect(primera.locator('.rotbadge')).toHaveText('180°')

    // Quitar una página la saca del tablero.
    await page.locator('.pcard').nth(3).getByTitle(/Quitar página/).click()
    await expect(page.locator('.pcard')).toHaveCount(3)

    await page.getByRole('button', { name: /Guardar 3 página/ }).click()
    await expect(page.locator('.banner')).toContainText('3 páginas', { timeout: 60_000 })

    const nombre = await descargarCon(page, page.getByRole('button', { name: /Descargar/ }).first())
    expect(nombre).toBe('CF-2024-G-101_organizado.pdf')
  })

  test('girar todas y limpiar giros afecta al tablero completo', async ({ page }) => {
    await abrir(page, 'Organizar')
    await subir(page, INFORME)

    await page.getByRole('button', { name: /Girar todas/ }).click()
    await expect(page.locator('.rotbadge')).toHaveCount(4)
    await expect(page.locator('.actionbar')).toContainText('4 página(s) giradas')

    await page.getByRole('button', { name: /Sin giros/ }).click()
    await expect(page.locator('.rotbadge')).toHaveCount(0)
  })

  test('el tamaño de miniatura cambia la densidad del tablero', async ({ page }) => {
    await abrir(page, 'Organizar')
    await subir(page, INFORME)
    const tablero = page.locator('.pageboard')
    await expect(tablero).toHaveClass(/sz-md/)
    await page.getByRole('button', { name: 'L', exact: true }).click()
    await expect(tablero).toHaveClass(/sz-lg/)
  })

  test('excluir todas deja el botón de guardar deshabilitado', async ({ page }) => {
    await abrir(page, 'Organizar')
    await subir(page, INFORME)
    await page.getByRole('button', { name: 'Excluir todas' }).click()
    await expect(page.getByRole('button', { name: /Guardar 0 página/ })).toBeDisabled()
  })
})
