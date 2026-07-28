import { useState } from 'react'
import type { MergeResult, Stage } from '../types'
import { b64ToPdfBlob, downloadBlob, mergePages } from '../api'
import { getDoc } from '../pdf'
import { errMsg } from '../util'
import { Ic } from '../icons'
import { Dropzone, ErrorNote, Stepper } from '../components/common'
import { PdfThumb } from '../components/PdfThumb'
import { PageBoard, type PageItem } from '../components/PageBoard'

export function UnirPanel() {
  const [stage, setStage] = useState<Stage>('empty')
  const [files, setFiles] = useState<File[]>([])
  const [items, setItems] = useState<PageItem[]>([])
  const [doCompress, setDoCompress] = useState(false)
  const [maxSize, setMaxSize] = useState(1)
  const [result, setResult] = useState<MergeResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addFiles = async (fs: File[]) => {
    setError(null); setBusy(true)
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
              included: true, sourceLabel: file.name, colorIdx: fileIndex,
            })
          }
        } catch {
          bad.push(file.name)
        }
      }
      if (bad.length) setError(`No se pudieron leer: ${bad.join(', ')}.`)
      setFiles((prev) => [...prev, ...fs])
      setItems((prev) => [...prev, ...newItems])
      if (newItems.length) setStage('loaded')
    } finally {
      setBusy(false)
    }
  }

  const run = async () => {
    const sequence = items.filter((it) => it.included).map((it) => [it.fileIndex, it.page] as [number, number])
    if (sequence.length === 0) { setError('Selecciona al menos una página.'); return }
    setBusy(true); setError(null)
    try {
      const res = await mergePages(files, sequence, { maxSizeMb: doCompress ? maxSize : 0 })
      setResult(res); setStage('result')
    } catch (e) {
      setError(errMsg(e, 'Falló la unión.'))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { setStage('empty'); setFiles([]); setItems([]); setResult(null); setError(null) }

  const includedCount = items.filter((it) => it.included).length
  const stepN = stage === 'empty' ? 1 : stage === 'loaded' ? 2 : 3

  return (
    <section className="panel">
      <div className="head">
        <h1>Unir y organizar</h1>
        <p>Sube varios PDF y arma el expediente viendo las páginas: arrástralas para reordenar, quita las que no van. No necesitas saber números de página de antemano.</p>
      </div>

      <Stepper n={stepN} />
      {error && <ErrorNote msg={error} />}

      {stage === 'empty' && (
        <Dropzone
          onFiles={addFiles} multiple busy={busy}
          title="Arrastra varios PDF para combinarlos"
          sub="Verás las páginas de todos como miniaturas para ordenarlas a tu gusto. Todo local; nada sale a internet."
          cta="Seleccionar archivos"
        />
      )}

      {stage === 'loaded' && (
        <>
          <div className="board-toolbar">
            <div className="rowflex">
              <span className="chip good tnum">{includedCount} página(s)</span>
              <span className="hint">Arrastra para reordenar · <b>Tab</b> + <b>Espacio</b> para mover con teclado · <b>Supr</b> quita</span>
            </div>
            <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
              {Ic.plus} Agregar más
              <input type="file" accept="application/pdf" hidden multiple
                onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = '' }} />
            </label>
          </div>

          <PageBoard
            items={items}
            onReorder={setItems}
            onToggle={(id) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, included: !it.included } : it)))}
            onRemove={(id) => setItems((prev) => prev.filter((it) => it.id !== id))}
          />

          <div className="card ctl" style={{ marginTop: 18 }}>
            <label className="rowflex" style={{ cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={doCompress} onChange={(e) => setDoCompress(e.target.checked)} />
              Comprimir el resultado a un límite
            </label>
            {doCompress && (
              <div className="hint rowflex" style={{ marginTop: 10 }}>
                Objetivo:
                <div className="seg">
                  {[1, 2].map((v) => (
                    <button key={v} className={maxSize === v ? 'on' : ''} onClick={() => setMaxSize(v)}>
                      {v} MB{v === 1 ? ' · Hacienda' : ''}
                    </button>
                  ))}
                </div>
                <input className="num tnum" type="number" min={0.1} step={0.1} value={maxSize}
                  onChange={(e) => setMaxSize(Math.max(0.1, Number(e.target.value) || 0.1))} /> MB
              </div>
            )}
          </div>

          <div className="actionbar">
            <button className="btn btn-primary btn-lg" disabled={busy || includedCount === 0} onClick={run}>
              {busy ? <><span className="spinner" /> Uniendo…</> : <>{Ic.unir} Unir {includedCount} página(s)</>}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={reset}>Empezar de nuevo</button>
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
                  ? `Unido (${result.num_pages} páginas) — ${result.size_mb.toFixed(2)} MB, sobre el objetivo.`
                  : `Listo — ${result.num_pages} páginas en un archivo de ${result.size_mb.toFixed(2)} MB.`}
              </strong>
              <p>{result.compressed ? 'Se comprimió para cumplir el límite.' : 'Sin compresión.'}</p>
            </div>
            <button className="btn btn-primary" onClick={() => downloadBlob(b64ToPdfBlob(result.content_b64), result.filename)}>
              {Ic.download} Descargar
            </button>
          </div>

          <div className="result-grid">
            <div className="card rcard">
              <PdfThumb b64={result.content_b64} label={`${result.num_pages} pág.`} />
              <div className="rmeta">
                <div className="nm">{result.filename}<small>{result.compressed ? 'Comprimido' : 'Sin comprimir'}</small></div>
                <span className={`chip tnum ${result.oversized ? 'warn' : 'good'}`}>{result.size_mb.toFixed(2)} MB</span>
              </div>
              <button className="btn btn-ghost" style={{ width: '100%' }}
                onClick={() => downloadBlob(b64ToPdfBlob(result.content_b64), result.filename)}>
                {Ic.download} Descargar
              </button>
            </div>
          </div>

          <div className="actionbar">
            <button className="btn btn-ghost" onClick={() => setStage('loaded')}>Ajustar</button>
            <button className="btn btn-ghost" onClick={reset}>Empezar de nuevo</button>
          </div>
        </>
      )}
    </section>
  )
}
