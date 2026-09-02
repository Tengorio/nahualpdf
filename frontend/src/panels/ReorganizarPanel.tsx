import { useState } from 'react'
import type { MergeResult, Stage } from '../types'
import { b64ToPdfBlob, downloadBlob, mergePages } from '../api'
import { errMsg, formatSize } from '../util'
import { countDuplexBlanks, toSequence, usePageBoard } from '../usePageBoard'
import { Dropzone, ErrorNote, SingleResult, SizeLimitControl, Stepper } from '../components/common'
import { PdfThumb } from '../components/PdfThumb'
import { PageBoard } from '../components/PageBoard'
import { BoardHints, BoardToolbar } from '../components/BoardToolbar'
import { Ic } from '../icons'

export function ReorganizarPanel() {
  const board = usePageBoard()
  const [stage, setStage] = useState<Stage>('empty')
  const [doCompress, setDoCompress] = useState(false)
  const [padForDuplex, setPadForDuplex] = useState(false)
  const [maxSize, setMaxSize] = useState(1)
  const [result, setResult] = useState<MergeResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async (fs: File[]) => {
    const added = await board.addFiles(fs)
    if (added) setStage('loaded')
  }

  const run = async () => {
    const sequence = toSequence(board.items)
    if (sequence.length === 0) {
      setError('Deja al menos una página incluida en el documento.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await mergePages(board.files, sequence, {
        maxSizeMb: doCompress ? maxSize : 0,
        padForDuplex,
      })
      setResult(res)
      setStage('result')
    } catch (e) {
      setError(errMsg(e, 'No se pudo generar el documento.'))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    board.clear()
    setStage('empty')
    setResult(null)
    setError(null)
  }

  const includedCount = board.items.filter((it) => it.included).length
  const rotatedCount = board.items.filter((it) => it.rotation !== 0).length
  const blanksPreview = countDuplexBlanks(toSequence(board.items))
  const stepN = stage === 'empty' ? 1 : stage === 'loaded' ? 2 : 3
  const shownError = error ?? board.loadError

  return (
    <section className="panel">
      <div className="head">
        <h1>Reorganizar o unir</h1>
        <p>
          Sube uno o varios PDF para reordenar páginas, girarlas, eliminar las que no van o combinar varios
          documentos en uno solo. Ves cada página, así que no hay que adivinar números.
        </p>
      </div>

      <Stepper n={stepN} />
      {shownError && <ErrorNote msg={shownError} />}

      {stage === 'empty' && (
        <Dropzone
          onFiles={load}
          multiple
          busy={board.loading}
          title="Arrastra uno o varios PDF aquí"
          sub="Verás las páginas de todos como miniaturas para ordenarlas, girarlas y combinarlas a tu gusto. Todo local; nada sale a internet."
          cta="Seleccionar archivos"
        />
      )}

      {stage === 'loaded' && (
        <>
          <BoardToolbar
            items={board.items}
            setItems={board.setItems}
            size={board.size}
            setSize={board.setSize}
            onAddFiles={load}
          />
          <BoardHints />

          <PageBoard
            items={board.items}
            size={board.size}
            onReorder={board.setItems}
            onToggle={board.toggle}
            onRemove={board.remove}
            onRotate={board.rotate}
          />

          <div className="card ctl" style={{ marginTop: 18 }}>
            <label className="rowflex" style={{ cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={padForDuplex}
                onChange={(e) => setPadForDuplex(e.target.checked)}
              />
              Unir para imprimir (doble cara)
            </label>
            <div className="hint" style={{ marginTop: 10 }}>
              {padForDuplex
                ? blanksPreview > 0
                  ? `${blanksPreview === 1 ? 'Se agregará 1 hoja en blanco' : `Se agregarán ${blanksPreview} hojas en blanco`}: los documentos con páginas impares la llevan al final para que el siguiente empiece en hoja nueva.`
                  : 'Todos los documentos tienen páginas pares: no hace falta ninguna hoja en blanco.'
                : 'Agrega una hoja en blanco al final de cada documento con páginas impares, para que al imprimir a doble cara no queden dos documentos en la misma hoja.'}
            </div>
          </div>

          <SizeLimitControl
            enabled={doCompress}
            setEnabled={setDoCompress}
            value={maxSize}
            setValue={setMaxSize}
            label="Comprimir el resultado a un límite"
          />

          <div className="actionbar">
            <button
              className="btn btn-primary btn-lg"
              disabled={busy || includedCount === 0}
              onClick={run}
            >
              {busy ? (
                <>
                  <span className="spinner" /> Procesando…
                </>
              ) : (
                <>
                  {Ic.reorganizar} Guardar {includedCount} página(s)
                </>
              )}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={reset}>
              Empezar de nuevo
            </button>
            {rotatedCount > 0 && <span className="hint">{rotatedCount} página(s) giradas</span>}
          </div>
        </>
      )}

      {stage === 'result' && result && (
        <SingleResult
          result={result}
          okTitle="Listo"
          onDownload={() => downloadBlob(b64ToPdfBlob(result.content_b64), result.filename)}
          onBack={() => setStage('loaded')}
          onReset={reset}
        >
          <div className="result-grid">
            <div className="card rcard">
              <PdfThumb b64={result.content_b64} label={`${result.num_pages} pág.`} />
              <div className="rmeta">
                <div className="nm" title={result.filename}>
                  {result.filename}
                  <small>
                    {result.compressed ? 'Comprimido' : 'Sin comprimir'}
                    {result.blank_pages
                      ? ` · ${result.blank_pages} ${result.blank_pages === 1 ? 'hoja en blanco' : 'hojas en blanco'} para doble cara`
                      : ''}
                  </small>
                </div>
                <span className={`chip tnum ${result.oversized ? 'warn' : 'good'}`}>
                  {formatSize(result.size_mb)}
                </span>
              </div>
              <button
                className="btn btn-ghost"
                style={{ width: '100%' }}
                onClick={() => downloadBlob(b64ToPdfBlob(result.content_b64), result.filename)}
              >
                {Ic.download} Descargar
              </button>
            </div>
          </div>
        </SingleResult>
      )}
    </section>
  )
}
