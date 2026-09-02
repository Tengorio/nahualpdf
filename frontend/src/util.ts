/** Reparte num_pages en n rangos contiguos parejos (espejo del backend). */
export function evenRanges(numPages: number, n: number): string[] {
  n = Math.max(1, Math.min(n, numPages))
  const base = Math.floor(numPages / n)
  const rem = numPages % n
  const out: string[] = []
  let start = 1
  for (let i = 0; i < n; i++) {
    const count = base + (i < rem ? 1 : 0)
    const end = start + count - 1
    out.push(`${start}-${end}`)
    start = end + 1
  }
  return out
}

/**
 * Convierte un error capturado en un mensaje amigable y claro en español.
 * Traduce errores de transporte de red (Failed to fetch, cortes de conexión)
 * y códigos de estado HTTP a explicaciones comprensibles y accionables.
 */
export function errMsg(e: unknown, fallback: string): string {
  if (e instanceof Error) {
    const msg = e.message.trim()
    const lower = msg.toLowerCase()

    if (
      lower.includes('failed to fetch') ||
      lower.includes('networkerror') ||
      lower.includes('load failed') ||
      lower.includes('network request failed')
    ) {
      return 'No se pudo conectar con el servidor local o se interrumpió la transferencia. Comprueba tu conexión de red e intenta subir el archivo de nuevo.'
    }

    if (lower.includes('aborterror') || lower.includes('aborted')) {
      return 'La operación fue cancelada o tardó demasiado tiempo en responder.'
    }

    if (msg.startsWith('Error 413')) {
      return 'El archivo es demasiado grande para transferirse en una sola petición.'
    }

    if (msg.startsWith('Error 502') || msg.startsWith('Error 503') || msg.startsWith('Error 504')) {
      return 'El servicio de NahualPDF no está respondiendo en este momento. Intenta de nuevo en unos segundos.'
    }

    if (msg.startsWith('Error 500')) {
      return 'Ocurrió un error en el servidor al procesar el archivo. Verifica que el PDF no esté dañado.'
    }

    if (msg) return msg
  }
  return fallback
}

/**
 * Tamaño legible a partir de MB. Un expediente de 4 KB mostrado como "0.00 MB"
 * no le dice nada a nadie, así que por debajo de 1 MB se reporta en KB.
 */
export function formatSize(mb: number): string {
  if (mb >= 1) return `${mb.toFixed(2)} MB`
  const kb = mb * 1024
  if (kb >= 1) return `${Math.round(kb)} KB`
  return `${Math.max(1, Math.round(kb * 1024))} B`
}
