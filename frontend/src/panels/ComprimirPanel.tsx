import { useState } from 'react'
import type { CompressResult, PdfInfo, Stage } from '../types'
import { b64ToPdfBlob, compress, downloadBlob, fetchPdfInfo } from '../api'
import { errMsg } from '../util'
import { Ic } from '../icons'
import { Dropzone, ErrorNote, Stepper } from '../components/common'
import { PdfThumb } from '../components/PdfThumb'

export function ComprimirPanel() {
  const [stage, setStage] = useState<Stage>('empty')
  const [file, setFile] = useState<File | null>(null)
  const [info, setInfo] = useState<PdfInfo | null>(null)
  const [maxSize, setMaxSize] = useState(1)
  const [preserveText, setPreserveText] = useState(true)
  const [result, setResult] = useState<CompressResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPick = async (f: File) => {
    setError(null); setBusy(true)
    try {
      const meta = await fetchPdfInfo(f)
      setFile(f); setInfo(meta); setResult(null); setStage('loaded')
    } catch (e) {
      setError(errMsg(e, 'No se pudo leer el PDF.'))
    } finally {
      setBusy(false)
    }
  }

  const run = async () => {
    if (!file) return
    setBusy(true); setError(null)
    try {
      const res = await compress(file, { maxSizeMb: maxSize, preserveText })
      setResult(res); setStage('result')
    } catch (e) {
      setError(errMsg(e, 'Falló la compresión.'))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { setStage('empty'); setFile(null); setInfo(null); setResult(null); setError(null) }
  const stepN = stage === 'empty' ? 1 : stage === 'loaded' ? 2 : 3

  const reduction = result ? result.original_size_mb - result.size_mb : 0
  const pct = result && result.original_size_mb > 0 ? (reduction / result.original_size_mb) * 100 : 0

  return (
    <section className="panel">
      <div className="head">
        <h1>Comprimir a un límite</h1>
        <p>Reduce un PDF hasta un tamaño objetivo, preservando el texto seleccionable siempre que sea posible.</p>
      </div>

      <Stepper n={stepN} />
      {error && <ErrorNote msg={error} />}

      {stage === 'empty' && (
        <Dropzone
          onFiles={(fs) => onPick(fs[0])} busy={busy}
          title="Arrastra un PDF para comprimirlo"
          sub="Tú fijas el objetivo y la herramienta elige la estrategia — sin pixelear el texto nítido."
          cta="Seleccionar PDF"
        />
      )}

      {stage === 'loaded' && info && (
        <>
          <div className="card docbar">
            <div className="fileic" />
            <div className="meta">
              <div className="nm">{info.filename}</div>
              <div className="dt">
                {info.num_pages} páginas · {info.has_text ? 'texto seleccionable' : 'sin texto seleccionable'}
              </div>
            </div>
            <span className={`chip tnum ${info.size_mb > maxSize ? 'crit' : 'good'}`}>{info.size_mb.toFixed(2)} MB</span>
          </div>

          {info.size_mb <= maxSize && (
            <div className="note accent">{Ic.info}
              El archivo ya pesa {info.size_mb.toFixed(2)} MB, dentro del objetivo de {maxSize} MB. Puedes bajar el objetivo o descargarlo tal cual.
            </div>
          )}

          <div className="controls">
            <div className="card ctl">
              <div className="lbl">Tamaño objetivo</div>
              <div className="seg">
                {[1, 2].map((v) => (
                  <button key={v} className={maxSize === v ? 'on' : ''} onClick={() => setMaxSize(v)}>
                    {v} MB{v === 1 ? ' · Hacienda' : ''}
                  </button>
                ))}
              </div>
              <div className="hint rowflex">
                Otro:
                <input className="num tnum" type="number" min={0.1} step={0.1} value={maxSize}
                  onChange={(e) => setMaxSize(Math.max(0.1, Number(e.target.value) || 0.1))} /> MB
              </div>
            </div>

            <div className="card ctl">
              <div className="lbl">Calidad</div>
              <label className="rowflex" style={{ cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={preserveText} onChange={(e) => setPreserveText(e.target.checked)} />
                Preservar texto seleccionable
              </label>
              <div className="hint">
                {preserveText
                  ? <>Solo rasteriza las páginas <b>sin</b> texto; las nítidas se quedan intactas.</>
                  : <>Rasteriza todo — comprime más, pero el texto deja de ser seleccionable.</>}
              </div>
            </div>
          </div>

          <div className="actionbar">
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={run}>
              {busy ? <><span className="spinner" /> Comprimiendo…</> : <>{Ic.comprimir} Comprimir</>}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={reset}>Cambiar documento</button>
          </div>
        </>
      )}

      {stage === 'result' && result && (
        <>
          <div className={`banner${result.oversized ? ' warn' : ''}`}>
            <span style={{ flex: 'none', width: 26, height: 26, color: result.oversized ? 'var(--warn)' : 'var(--good)' }}>
              {result.oversized ? Ic.warn : Ic.check}
            </span>
            <div className="txt">
              <strong>
                {result.oversized
                  ? `Reducido a ${result.size_mb.toFixed(2)} MB — aún sobre el objetivo de ${maxSize} MB.`
                  : `Listo — ${result.size_mb.toFixed(2)} MB, dentro de ${maxSize} MB.`}
              </strong>
              <p>
                {result.compressed
                  ? `De ${result.original_size_mb.toFixed(2)} MB a ${result.size_mb.toFixed(2)} MB (−${pct.toFixed(0)}%).`
                  : 'No necesitó compresión.'}
                {result.oversized ? ' Preservando el texto no se pudo bajar más; prueba desactivar “preservar texto” o subir el objetivo.' : ''}
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => downloadBlob(b64ToPdfBlob(result.content_b64), result.filename)}>
              {Ic.download} Descargar
            </button>
          </div>

          <div className="result-grid">
            <div className="card rcard">
              <PdfThumb b64={result.content_b64} label={result.compressed ? 'Comprimido' : 'Original'} />
              <div className="rmeta">
                <div className="nm">{result.filename}<small>{result.compressed ? `−${pct.toFixed(0)}% de tamaño` : 'Sin cambios'}</small></div>
                <span className={`chip tnum ${result.oversized ? 'warn' : 'good'}`}>{result.size_mb.toFixed(2)} MB</span>
              </div>
              <button className="btn btn-ghost" style={{ width: '100%' }}
                onClick={() => downloadBlob(b64ToPdfBlob(result.content_b64), result.filename)}>
                {Ic.download} Descargar
              </button>
            </div>
          </div>

          <div className="actionbar">
            <button className="btn btn-ghost" onClick={() => setStage('loaded')}>Ajustar objetivo</button>
            <button className="btn btn-ghost" onClick={reset}>Empezar de nuevo</button>
          </div>
        </>
      )}
    </section>
  )
}
