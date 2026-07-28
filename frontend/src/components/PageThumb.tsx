import { useEffect, useRef, useState } from 'react'
import { renderPage } from '../pdf'

/**
 * Miniatura de UNA página de un File, renderizada de forma perezosa: solo se
 * dibuja cuando la tarjeta entra en el viewport (IntersectionObserver). Así un
 * tablero con cientos de páginas no intenta renderizarlas todas de golpe.
 */
export function PageThumb({ file, page }: { file: File; page: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<'idle' | 'ok' | 'error'>('idle')

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    ;(async () => {
      try {
        if (canvasRef.current) await renderPage(file, page, canvasRef.current)
        if (!cancelled) setState('ok')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => { cancelled = true }
  }, [visible, file, page])

  return (
    <div className="pagethumb" ref={wrapRef}>
      {state !== 'ok' && <span className="pv-ph shimmer" />}
      <canvas ref={canvasRef} className="pv-canvas" style={{ opacity: state === 'ok' ? 1 : 0 }} />
    </div>
  )
}
