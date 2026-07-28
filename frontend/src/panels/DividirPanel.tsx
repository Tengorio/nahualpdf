import { useState } from 'react'
import JSZip from 'jszip'
import type { PdfInfo, Part, SplitMode, Stage } from '../types'
import { b64ToPdfBlob, downloadBlob, fetchPdfInfo, splitAuto, splitManual } from '../api'
import { evenRanges, errMsg, formatSize } from '../util'
import { Ic } from '../icons'
import { Dropzone, ErrorNote, Stepper } from '../components/common'
import { PdfThumb } from '../components/PdfThumb'

export function DividirPanel() {
  const [stage, setStage] = useState<Stage>('empty')
  const [file, setFile] = useState<File | null>(null)
  const [info, setInfo] = useState<PdfInfo | null>(null)
  const [mode, setMode] = useState<SplitMode>('auto')
  const [maxSize, setMaxSize] = useState(1)
  const [ranges, setRanges] = useState<string[]>(['1-1', '1-1'])
  const [parts, setParts] = useState<Part[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPick = async (f: File) => {
    setError(null); setBusy(true)
    try {
      const meta = await fetchPdfInfo(f)
      setFile(f); setInfo(meta)
      setRanges(evenRanges(meta.num_pages, Math.min(2, meta.num_pages)))
      setParts([]); setStage('loaded')
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
      const res = mode === 'auto'
        ? await splitAuto(file, { maxSizeMb: maxSize })
        : await splitManual(file, ranges, { maxSizeMb: maxSize })
      setParts(res.parts); setStage('result')
    } catch (e) {
      setError(errMsg(e, 'Falló la división.'))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { setStage('empty'); setFile(null); setInfo(null); setParts([]); setError(null) }

  const valid = parts.filter((p) => !p.error)
  const compressed = valid.filter((p) => p.compressed)
  const oversized = valid.filter((p) => p.oversized)
  const errored = parts.filter((p) => p.error)

  const downloadAll = async () => {
    const zip = new JSZip()
    valid.forEach((p) => p.content_b64 && zip.file(p.filename, p.content_b64, { base64: true }))
    const blob = await zip.generateAsync({ type: 'blob' })
    const base = info?.project_key ?? (file ? file.name.replace(/\.pdf$/i, '') : 'partes')
    downloadBlob(blob, `${base}_partes.zip`)
  }

  const stepN = stage === 'empty' ? 1 : stage === 'loaded' ? 2 : 3

  return (
    <section className="panel">
      <div className="head">
        <h1>Dividir un expediente</h1>
        <p>Parte un PDF en archivos que cumplan el límite de tamaño de las plataformas de Hacienda — sin tener que iterar a mano.</p>
      </div>

      <Stepper n={stepN} />
      {error && <ErrorNote msg={error} />}

      {stage === 'empty' && (
        <Dropzone
          onFiles={(fs) => onPick(fs[0])} busy={busy}
          title="Arrastra tu PDF aquí"
          sub="o selecciónalo de tu equipo. Se procesa en el servidor local; nada sale a internet."
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
                {info.project_key ? ` · clave ${info.project_key}` : ''}
              </div>
            </div>
            <span className={`chip tnum ${info.size_mb > maxSize ? 'crit' : 'good'}`}>{formatSize(info.size_mb)}</span>
          </div>

          <div className="controls">
            <div className="card ctl">
              <div className="lbl">Límite por archivo</div>
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
              <div className="lbl">Cómo dividir</div>
              <div className="seg">
                <button className={mode === 'auto' ? 'on' : ''} onClick={() => setMode('auto')}>Automático</button>
                <button className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}>Manual</button>
              </div>
              <div className="hint">
                {mode === 'auto'
                  ? <><b>Prioriza calidad:</b> parte por tamaño sin comprimir; solo comprime una página suelta si por sí sola se pasa.</>
                  : <><b>Control total:</b> tú defines el rango de páginas de cada archivo.</>}
              </div>
            </div>
          </div>

          {mode === 'auto' ? (
            <div className="note">{Ic.warn}
              Al priorizar la calidad puede generar varios archivos. Si necesitas menos archivos o elegir dónde cortar, usa el modo <b>Manual</b>.
            </div>
          ) : (
            <>
              <div className="rowflex" style={{ marginTop: 14 }}>
                <span className="hint">¿Cuántos archivos?</span>
                <input className="num tnum" type="number" min={1} max={info.num_pages} value={ranges.length}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(info.num_pages, Number(e.target.value) || 1))
                    setRanges(evenRanges(info.num_pages, n))
                  }} />
              </div>
              <div className="manual-ranges">
                {ranges.map((r, i) => (
                  <div className="rfield" key={i}>
                    <label>Archivo {i + 1}</label>
                    <input className="mono" value={r}
                      onChange={(e) => setRanges(ranges.map((x, j) => (j === i ? e.target.value : x)))} />
                  </div>
                ))}
              </div>
              <div className="note accent">{Ic.info}
                Rangos sugeridos parejos — ajústalos libremente. Solo se comprime lo que rebase {maxSize} MB.
              </div>
            </>
          )}

          <div className="actionbar">
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={run}>
              {busy ? <><span className="spinner" /> Procesando…</> : <>{Ic.dividir} Dividir</>}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={reset}>Cambiar documento</button>
          </div>
        </>
      )}

      {stage === 'result' && (
        <>
          <div className={`banner${oversized.length ? ' warn' : ''}`}>
            <span style={{ flex: 'none', width: 26, height: 26, color: oversized.length ? 'var(--warn)' : 'var(--good)' }}>
              {oversized.length ? Ic.warn : Ic.check}
            </span>
            <div className="txt">
              <strong>
                {oversized.length
                  ? `${valid.length} archivo(s), ${oversized.length} aún sobre ${maxSize} MB.`
                  : `Listo — ${valid.length} archivo(s), todos por debajo de ${maxSize} MB.`}
              </strong>
              <p>
                {compressed.length
                  ? `${valid.length - compressed.length} parte(s) intactas (calidad original), ${compressed.length} comprimida(s).`
                  : 'Todas las partes conservan su calidad original.'}
                {errored.length ? ` ${errored.length} rango(s) inválido(s): ${errored.map((p) => p.range).join(', ')}.` : ''}
              </p>
            </div>
            {valid.length > 0 && (
              <button className="btn btn-primary" onClick={downloadAll}>{Ic.download} Descargar todo (.zip)</button>
            )}
          </div>

          <div className="result-grid">
            {valid.map((p, i) => (
              <div className="card rcard" key={p.index}>
                <PdfThumb b64={p.content_b64} label={`pág. ${p.range}`} />
                <div className="rmeta">
                  <div className="nm" title={p.filename}>{p.filename}<small>{p.compressed ? 'Comprimida' : 'Sin comprimir'}</small></div>
                  <span className={`chip tnum ${p.oversized ? 'warn' : 'good'}`}>{formatSize(p.size_mb)}</span>
                </div>
                <button className="btn btn-ghost" style={{ width: '100%' }}
                  onClick={() => p.content_b64 && downloadBlob(b64ToPdfBlob(p.content_b64), p.filename)}>
                  {Ic.download} Descargar {i + 1}
                </button>
              </div>
            ))}
          </div>

          <div className="actionbar">
            <button className="btn btn-ghost" onClick={() => setStage('loaded')}>Ajustar cortes</button>
            <button className="btn btn-ghost" onClick={reset}>Empezar de nuevo</button>
          </div>
        </>
      )}
    </section>
  )
}
