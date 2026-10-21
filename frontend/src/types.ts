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
  /** Hojas en blanco agregadas al unir para imprimir a doble cara. */
  blank_pages?: number
}

export interface HaciendaParte {
  nombre: string
  paginas: string
  size_mb: number
  content_b64: string
}

/** Resultado de «Preparar para Hacienda» (D-09) para un documento. */
export interface HaciendaResult {
  archivo: string
  num_pages: number
  original_size_mb: number
  partes: HaciendaParte[]
  accion: string
  parecido_minimo: number | null
  tinta_perdida_maxima: number | null
  texto_identico: boolean | null
  advertencias: string[]
  receta_nombre: string
  receta_texto: string
}

export type Tool = 'hacienda' | 'reorganizar' | 'dividir' | 'comprimir' | 'unir' | 'organizar'
export type SplitMode = 'auto' | 'manual'
export type Stage = 'empty' | 'loaded' | 'result'
/** Tamaño de las miniaturas del tablero de páginas. */
export type BoardSize = 'sm' | 'md' | 'lg'
