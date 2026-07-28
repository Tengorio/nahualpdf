import type { CompressResult, MergeResult, PdfInfo, SplitResult } from './types'

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Error ${res.status}`
    try {
      const body = await res.json()
      if (body?.detail) detail = body.detail
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export async function fetchPdfInfo(file: File): Promise<PdfInfo> {
  const form = new FormData()
  form.append('file', file)
  return handle<PdfInfo>(await fetch('/api/pdf/info', { method: 'POST', body: form }))
}

export interface SplitParams {
  maxSizeMb: number
  dpi?: number
  quality?: number
  preserveText?: boolean
}

export async function splitAuto(file: File, p: SplitParams): Promise<SplitResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('max_size_mb', String(p.maxSizeMb))
  form.append('dpi', String(p.dpi ?? 150))
  form.append('quality', String(p.quality ?? 80))
  form.append('preserve_text', String(p.preserveText ?? true))
  return handle<SplitResult>(await fetch('/api/split/auto', { method: 'POST', body: form }))
}

export async function splitManual(
  file: File,
  ranges: string[],
  p: SplitParams,
): Promise<SplitResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('ranges', JSON.stringify(ranges))
  form.append('max_size_mb', String(p.maxSizeMb))
  form.append('dpi', String(p.dpi ?? 150))
  form.append('quality', String(p.quality ?? 80))
  form.append('preserve_text', String(p.preserveText ?? true))
  return handle<SplitResult>(await fetch('/api/split/manual', { method: 'POST', body: form }))
}

export interface MergeParams extends Partial<SplitParams> {
  maxSizeMb?: number // 0 / omitido = no comprimir
}

export async function compress(file: File, p: SplitParams): Promise<CompressResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('max_size_mb', String(p.maxSizeMb))
  form.append('dpi', String(p.dpi ?? 150))
  form.append('quality', String(p.quality ?? 80))
  form.append('preserve_text', String(p.preserveText ?? true))
  return handle<CompressResult>(await fetch('/api/compress', { method: 'POST', body: form }))
}

export async function merge(
  files: File[],
  ranges: string[],
  p: MergeParams,
): Promise<MergeResult> {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  form.append('ranges', JSON.stringify(ranges))
  form.append('max_size_mb', String(p.maxSizeMb ?? 0))
  form.append('dpi', String(p.dpi ?? 150))
  form.append('quality', String(p.quality ?? 80))
  form.append('preserve_text', String(p.preserveText ?? true))
  return handle<MergeResult>(await fetch('/api/merge', { method: 'POST', body: form }))
}

/** Página del tablero: [índice de archivo, número de página, giro en grados]. */
export type PageRef = [number, number] | [number, number, number]

function pageSequenceForm(files: File[], sequence: PageRef[], p: MergeParams): FormData {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  form.append('sequence', JSON.stringify(sequence))
  form.append('max_size_mb', String(p.maxSizeMb ?? 0))
  form.append('dpi', String(p.dpi ?? 150))
  form.append('quality', String(p.quality ?? 80))
  form.append('preserve_text', String(p.preserveText ?? true))
  return form
}

export async function mergePages(
  files: File[],
  sequence: PageRef[],
  p: MergeParams,
): Promise<MergeResult> {
  const body = pageSequenceForm(files, sequence, p)
  return handle<MergeResult>(await fetch('/api/merge/pages', { method: 'POST', body }))
}

/** Reordenar / girar / eliminar páginas de uno o varios documentos. */
export async function organize(
  files: File[],
  sequence: PageRef[],
  p: MergeParams,
): Promise<MergeResult> {
  const body = pageSequenceForm(files, sequence, p)
  return handle<MergeResult>(await fetch('/api/organize', { method: 'POST', body }))
}

/** base64 (de la API) -> Uint8Array. */
export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** base64 -> Blob de PDF para descargar. */
export function b64ToPdfBlob(b64: string): Blob {
  const bytes = b64ToBytes(b64)
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
