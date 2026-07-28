export interface PdfInfo {
  filename: string
  num_pages: number
  size_mb: number
  has_text: boolean
  text_ratio: number
  project_key: string | null
}

export interface Part {
  index: number
  filename: string
  range: string
  size_mb: number
  compressed: boolean
  oversized: boolean
  error: boolean
  content_b64: string | null
}

export interface SplitResult {
  parts: Part[]
}

export interface CompressResult {
  filename: string
  original_size_mb: number
  size_mb: number
  compressed: boolean
  oversized: boolean
  content_b64: string
}

export interface MergeResult {
  filename: string
  num_pages: number
  size_mb: number
  compressed: boolean
  oversized: boolean
  content_b64: string
}

export type Tool = 'dividir' | 'unir' | 'comprimir' | 'organizar'
export type SplitMode = 'auto' | 'manual'
export type Stage = 'empty' | 'loaded' | 'result'
/** Tamaño de las miniaturas del tablero de páginas. */
export type BoardSize = 'sm' | 'md' | 'lg'
