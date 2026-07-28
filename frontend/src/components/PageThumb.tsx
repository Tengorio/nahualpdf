import { useEffect, useRef, useState } from 'react'
import { renderPage } from '../pdf'

/**
 * Miniatura de UNA página de un File, renderizada de forma perezosa: solo se
 * dibuja cuando la tarjeta entra en el viewport (IntersectionObserver). Así un
 * tablero con cientos de páginas no intenta renderizarlas todas de golpe.
 *
 * `rotation` (0/90/180/270) se aplica al render, no por CSS, para que la
 * miniatura se vea exactamente como saldrá el PDF.
 */
export function PageThumb({ file, page, rotation = 0 }: { file: File; page: number; rotation?: number }) {
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
        if (canvasRef.current) await renderPage(file, page, canvasRef.current, 180, rotation)
        if (!cancelled) setState('ok')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => { cancelled = true }
  }, [visible, file, page, rotation])

  return (
    <div className="pagethumb" ref={wrapRef}>
      {state !== 'ok' && <span className="pv-ph shimmer" />}
      {state === 'error' && <span className="pv-err">sin vista previa</span>}
      <canvas ref={canvasRef} className="pv-canvas" style={{ opacity: state === 'ok' ? 1 : 0 }} />
    </div>
  )
}
