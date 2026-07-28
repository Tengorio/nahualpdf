import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

/* Carga diferida y única de pdf.js (la lib pesada solo baja cuando se usa). */
let libPromise: Promise<typeof import('pdfjs-dist')> | null = null
function getLib() {
  if (!libPromise) {
    libPromise = (async () => {
      const lib = await import('pdfjs-dist')
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
      lib.GlobalWorkerOptions.workerSrc = workerUrl
      return lib
    })()
  }
  return libPromise
}

/* Documento pdf.js cacheado por objeto File (se parsea una sola vez por archivo). */
const docCache = new WeakMap<File, Promise<PDFDocumentProxy>>()
export function getDoc(file: File): Promise<PDFDocumentProxy> {
  let p = docCache.get(file)
  if (!p) {
    p = (async () => {
      const lib = await getLib()
      const data = new Uint8Array(await file.arrayBuffer())
      return lib.getDocument({ data }).promise
    })()
    docCache.set(file, p)
  }
  return p
}

async function paint(page: PDFPageProxy, canvas: HTMLCanvasElement, targetW: number, rotation = 0) {
  // `rotation` se suma a la que ya trae la página en el PDF, igual que hace el
  // backend al escribir /Rotate — así la miniatura muestra el resultado real.
  const base = page.getViewport({ scale: 1, rotation: page.rotate + rotation })
  const viewport = page.getViewport({ scale: targetW / base.width, rotation: page.rotate + rotation })
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
}

/* Renderiza la página `pageNumber` de un File ya abierto, con giro opcional. */
export async function renderPage(
  file: File, pageNumber: number, canvas: HTMLCanvasElement, targetW = 180, rotation = 0,
) {
  const doc = await getDoc(file)
  const page = await doc.getPage(pageNumber)
  await paint(page, canvas, targetW, rotation)
}

/* Renderiza la primera página desde bytes (para las tarjetas de resultado). */
export async function renderBytes(bytes: Uint8Array, canvas: HTMLCanvasElement, targetW = 220) {
  const lib = await getLib()
  const doc = await lib.getDocument({ data: bytes }).promise
  const page = await doc.getPage(1)
  await paint(page, canvas, targetW)
}
