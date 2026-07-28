import { useCallback, useState } from 'react'
import type { BoardSize } from './types'
import type { PageItem } from './components/PageBoard'
import { getDoc } from './pdf'

/** Secuencia lista para la API: [[archivo, página, rotación], ...] de lo incluido. */
export function toSequence(items: PageItem[]): [number, number, number][] {
  return items.filter((it) => it.included).map((it) => [it.fileIndex, it.page, it.rotation])
}

/**
 * Estado compartido del tablero de páginas (lo usan Unir y Organizar):
 * carga los PDF, expande cada uno en sus páginas y expone las operaciones
 * de la tarjeta (incluir/excluir, girar, quitar, reordenar).
 */
export function usePageBoard() {
  const [files, setFiles] = useState<File[]>([])
  const [items, setItems] = useState<PageItem[]>([])
  const [size, setSize] = useState<BoardSize>('md')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const addFiles = useCallback(async (fs: File[]) => {
    if (fs.length === 0) return
    setLoadError(null)
    setLoading(true)
    try {
      const startIdx = files.length
      const newItems: PageItem[] = []
      const bad: string[] = []
      for (let k = 0; k < fs.length; k++) {
        const file = fs[k]
        const fileIndex = startIdx + k
        try {
          const doc = await getDoc(file)
          for (let page = 1; page <= doc.numPages; page++) {
            newItems.push({
              id: `${fileIndex}-${page}`, fileIndex, file, page,
              included: true, rotation: 0, sourceLabel: file.name, colorIdx: fileIndex,
            })
          }
        } catch {
          bad.push(file.name)
        }
      }
      if (bad.length) setLoadError(`No se pudieron leer: ${bad.join(', ')}.`)
      // Los archivos ilegibles se conservan en `files` para no descuadrar los
      // fileIndex ya asignados; simplemente no aportan páginas al tablero.
      setFiles((prev) => [...prev, ...fs])
      setItems((prev) => [...prev, ...newItems])
      return newItems.length
    } finally {
      setLoading(false)
    }
  }, [files.length])

  const toggle = useCallback((id: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, included: !it.included } : it)))
  }, [])

  const rotate = useCallback((id: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, rotation: (it.rotation + 90) % 360 } : it)))
  }, [])

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }, [])

  const clear = useCallback(() => {
    setFiles([]); setItems([]); setLoadError(null)
  }, [])

  return {
    files, items, setItems, size, setSize,
    loading, loadError, setLoadError,
    addFiles, toggle, rotate, remove, clear,
  }
}
