import { useEffect, useRef, useState } from 'react'
import { b64ToBytes } from '../api'
import { renderBytes } from '../pdf'

/**
 * Miniatura de la PRIMERA página de un PDF (base64), renderizada en el navegador
 * con pdf.js (carga diferida vía `../pdf`). No toca el servidor, así que generar
 * los archivos nunca se alenta. Degrada a un marcador limpio si algo falla.
 */
export function PdfThumb({ b64, label }: { b64: string | null; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    if (!b64) { setState('error'); return }
    let cancelled = false
    ;(async () => {
      try {
        if (canvasRef.current) await renderBytes(b64ToBytes(b64), canvasRef.current)
        if (!cancelled) setState('ok')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => { cancelled = true }
  }, [b64])

  return (
    <div className="pv">
      {label && <span className="tag">{label}</span>}
      {state !== 'ok' && <span className={`pv-ph${state === 'loading' ? ' shimmer' : ''}`} />}
      <canvas ref={canvasRef} className="pv-canvas" style={{ opacity: state === 'ok' ? 1 : 0 }} />
    </div>
  )
}
