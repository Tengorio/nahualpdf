import { useState } from 'react'
import JSZip from 'jszip'
import type { PdfInfo, Part, Stage } from '../types'
import { b64ToPdfBlob, downloadBlob, fetchPdfInfo, splitAuto, splitManual } from '../api'
import { evenRanges, errMsg, formatSize } from '../util'
import { Ic } from '../icons'
import { Dropzone, ErrorNote, Stepper } from '../components/common'
import { PdfThumb } from '../components/PdfThumb'

export type DivisionMode = 'hacienda' | 'manual'
export type ManualCriterion = 'size' | 'parts' | 'ranges'

export function DividirPanel() {
  const [stage, setStage] = useState<Stage>('empty')
  const [file, setFile] = useState<File | null>(null)
  const [info, setInfo] = useState<PdfInfo | null>(null)

  // Modo principal: Hacienda vs Manual
  const [mode, setMode] = useState<DivisionMode>('hacienda')

  // Submenú en modo Manual: qué variable se fija (solo una de las tres)
  const [manualCriterion, setManualCriterion] = useState<ManualCriterion>('size')

  // Variable 1: Tamaño fijado (en MB)
  const [maxSize, setMaxSize] = useState(2)

  // Variable 2: Número de partes fijado
  const [partCount, setPartCount] = useState(2)

  // Variable 3: Rangos de páginas fijados
  const [ranges, setRanges] = useState<string[]>(['1-1', '1-1'])

  const [parts, setParts] = useState<Part[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPick = async (f: File) => {
    setError(null)
    setBusy(true)
    try {
      const meta = await fetchPdfInfo(f)
      setFile(f)
      setInfo(meta)
      const initialParts = Math.min(2, Math.max(1, meta.num_pages))
      setPartCount(initialParts)
      setRanges(evenRanges(meta.num_pages, initialParts))
      setParts([])
      setStage('loaded')
    } catch (e) {
      setError(errMsg(e, 'No se pudo leer el PDF.'))
    } finally {
      setBusy(false)
    }
  }

  const run = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      let res
      if (mode === 'hacienda') {
        // Modo Hacienda: fijado estrictamente en 1.0 MB
        res = await splitAuto(file, { maxSizeMb: 1.0 })
      } else {
        // Modo Manual: según el criterio único fijado
        if (manualCriterion === 'size') {
          res = await splitAuto(file, { maxSizeMb: maxSize })
        } else if (manualCriterion === 'parts') {
          const totalPages = info?.num_pages ?? 1
          const calculatedRanges = evenRanges(totalPages, partCount)
          res = await splitManual(file, calculatedRanges, { maxSizeMb: 0 })
        } else {
          // 'ranges'
          res = await splitManual(file, ranges, { maxSizeMb: 0 })
        }
      }
      setParts(res.parts)
      setStage('result')
    } catch (e) {
      setError(errMsg(e, 'Falló la división.'))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setStage('empty')
    setFile(null)
    setInfo(null)
    setParts([])
    setError(null)
  }

  const addRange = () => {
    if (!info) return
    const nextStart = info.num_pages
    setRanges([...ranges, `${nextStart}-${nextStart}`])
  }

  const valid = parts.filter((p) => !p.error)
  const compressed = valid.filter((p) => p.compressed)
  const oversized = valid.filter((p) => p.oversized)
  const errored = parts.filter((p) => p.error)
  const targetMb = mode === 'hacienda' ? 1.0 : manualCriterion === 'size' ? maxSize : 0

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
        <p>
          Prepara archivos con el estándar de plataformas de Hacienda (SAT, DOF, PEF) o elige qué variable
          fijar para personalizar la división.
        </p>
      </div>

      <Stepper n={stepN} />
      {error && <ErrorNote msg={error} />}

      {/* 1. Selector de modo principal */}
      {stage !== 'result' && (
        <div className="card ctl" style={{ marginBottom: 16 }}>
          <div className="lbl">Objetivo de división</div>
          <div className="seg" style={{ width: '100%', display: 'flex' }}>
            <button
              type="button"
              style={{ flex: 1, textAlign: 'center', padding: '10px 14px' }}
              className={mode === 'hacienda' ? 'on' : ''}
              onClick={() => setMode('hacienda')}
            >
              Dividir para Hacienda (1 MB fijo)
            </button>
            <button
              type="button"
              style={{ flex: 1, textAlign: 'center', padding: '10px 14px' }}
              className={mode === 'manual' ? 'on' : ''}
              onClick={() => setMode('manual')}
            >
              Dividir manualmente
            </button>
          </div>

          {mode === 'hacienda' && (
            <div className="hint" style={{ marginTop: 12, lineHeight: 1.5 }}>
              <b>Estándar Hacienda (SAT, DOF, PEF):</b> límite predeterminado fijo de <b>1.0 MB</b> por
              archivo. El motor calcula las particiones óptimas automáticamente para cumplir con la norma
              sin perder calidad innecesariamente.
            </div>
          )}
        </div>
      )}

      {/* 2. Submenú en modo Manual: Solo una de las tres variables */}
      {mode === 'manual' && stage !== 'result' && (
        <div className="card ctl" style={{ marginBottom: 16 }}>
          <div className="lbl">¿Qué variable deseas fijar? (Elige una sola)</div>
          <div className="seg" style={{ width: '100%', display: 'flex', gap: 4 }}>
            <button
              type="button"
              style={{ flex: 1, textAlign: 'center', padding: '8px 10px', fontSize: 13 }}
              className={manualCriterion === 'size' ? 'on' : ''}
              onClick={() => setManualCriterion('size')}
            >
              1. Tamaño de archivo
            </button>
            <button
              type="button"
              style={{ flex: 1, textAlign: 'center', padding: '8px 10px', fontSize: 13 }}
              className={manualCriterion === 'parts' ? 'on' : ''}
              onClick={() => setManualCriterion('parts')}
            >
              2. Número de partes
            </button>
            <button
              type="button"
              style={{ flex: 1, textAlign: 'center', padding: '8px 10px', fontSize: 13 }}
              className={manualCriterion === 'ranges' ? 'on' : ''}
              onClick={() => setManualCriterion('ranges')}
            >
              3. Rangos de páginas
            </button>
          </div>

          {/* Detalle y configuración según la variable seleccionada */}
          <div style={{ marginTop: 14 }}>
            {manualCriterion === 'size' && (
              <div>
                <div className="rowflex wrap">
                  <span className="hint" style={{ margin: 0, fontWeight: 550, color: 'var(--ink)' }}>
                    Tamaño máximo por archivo:
                  </span>
                  <div className="seg">
                    {[1, 2, 5].map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={maxSize === v ? 'on' : ''}
                        onClick={() => setMaxSize(v)}
                      >
                        {v} MB
                      </button>
                    ))}
                  </div>
                  <div className="hint rowflex" style={{ margin: 0 }}>
                    Otro:
                    <input
                      className="num tnum"
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={maxSize}
                      onChange={(e) => setMaxSize(Math.max(0.1, Number(e.target.value) || 0.1))}
                    />{' '}
                    MB
                  </div>
                </div>
                <div className="hint" style={{ marginTop: 8 }}>
                  <b>La interfaz optimiza el resto:</b> calcula la cantidad de archivos y los puntos de
                  corte necesarios para que ninguna parte rebase <b>{maxSize} MB</b> con máxima calidad.
                </div>
              </div>
            )}

            {manualCriterion === 'parts' && (
              <div>
                <div className="rowflex">
                  <span className="hint" style={{ margin: 0, fontWeight: 550, color: 'var(--ink)' }}>
                    Número exacto de partes:
                  </span>
                  <input
                    className="num tnum"
                    type="number"
                    min={1}
                    max={info?.num_pages ?? 100}
                    value={partCount}
                    onChange={(e) => {
                      const max = info?.num_pages ?? 100
                      setPartCount(Math.max(1, Math.min(max, Number(e.target.value) || 1)))
                    }}
                  />{' '}
                  <span className="hint" style={{ margin: 0 }}>
                    archivos
                  </span>
                </div>
                <div className="hint" style={{ marginTop: 8 }}>
                  <b>La interfaz optimiza el resto:</b> reparte equitativamente las páginas en{' '}
                  <b>{partCount} archivos</b> de tamaño similar ({info ? `${evenRanges(info.num_pages, partCount).join(', ')}` : 'las páginas se calcularán al subir el PDF'}).
                </div>
              </div>
            )}

            {manualCriterion === 'ranges' && (
              <div>
                <div className="hint" style={{ margin: 0 }}>
                  <b>Control total sobre las páginas:</b> define libremente qué páginas corresponden a cada
                  archivo. {stage === 'empty' ? 'Al subir el documento podrás editar los rangos en el formulario.' : 'Edita los rangos en la lista inferior:'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Zona de carga (Stage: Empty) */}
      {stage === 'empty' && (
        <Dropzone
          onFiles={(fs) => onPick(fs[0])}
          busy={busy}
          title="Arrastra tu PDF aquí"
          sub={
            mode === 'hacienda'
              ? 'Se dividirá automáticamente para plataformas de Hacienda (límite fijo 1.0 MB). Todo local; nada sale a internet.'
              : manualCriterion === 'size'
              ? `Se dividirá fijando el tamaño máximo en ${maxSize} MB. Todo local; nada sale a internet.`
              : manualCriterion === 'parts'
              ? `Se dividirá fijando exactamente ${partCount} partes parejos. Todo local; nada sale a internet.`
              : 'Al cargarlo escribirás los rangos de páginas personalizados. Todo local; nada sale a internet.'
          }
          cta="Seleccionar PDF"
        />
      )}

      {/* 4. Documento cargado (Stage: Loaded) */}
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
            <span
              className={`chip tnum ${
                targetMb > 0 && info.size_mb > targetMb ? 'crit' : 'good'
              }`}
            >
              {formatSize(info.size_mb)}
            </span>
          </div>

          {/* Resumen o formulario de rangos según modo */}
          {mode === 'hacienda' ? (
            <div className="note accent">
              {Ic.info}
              El documento de <b>{formatSize(info.size_mb)}</b> ({info.num_pages} pág.) se dividirá en las partes
              automáticas necesarias de máximo <b>1.0 MB</b> para cumplir con el estándar institucional.
            </div>
          ) : manualCriterion === 'size' ? (
            <div className="note accent">
              {Ic.info}
              El motor dividirá el documento en partes automáticas de máximo <b>{maxSize} MB</b> conservando la
              resolución original de las páginas.
            </div>
          ) : manualCriterion === 'parts' ? (
            <div className="note accent">
              {Ic.info}
              El documento de {info.num_pages} páginas se dividirá en <b>{partCount} partes</b> equitativas:{' '}
              <code>{evenRanges(info.num_pages, partCount).join(', ')}</code>.
            </div>
          ) : (
            /* manualCriterion === 'ranges' */
            <div className="card ctl" style={{ marginTop: 14 }}>
              <div className="rowflex" style={{ justifyContent: 'space-between' }}>
                <div className="rowflex">
                  <span className="hint" style={{ margin: 0, fontWeight: 550, color: 'var(--ink)' }}>
                    Cantidad de partes:
                  </span>
                  <input
                    className="num tnum"
                    type="number"
                    min={1}
                    max={info.num_pages}
                    value={ranges.length}
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(info.num_pages, Number(e.target.value) || 1))
                      setRanges(evenRanges(info.num_pages, n))
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '6px 12px', fontSize: 12 }}
                  onClick={addRange}
                  disabled={ranges.length >= info.num_pages}
                >
                  {Ic.plus} Agregar parte
                </button>
              </div>

              <div className="manual-ranges">
                {ranges.map((r, i) => (
                  <div className="rfield" key={i}>
                    <label>Archivo {i + 1}</label>
                    <input
                      className="mono"
                      value={r}
                      placeholder="ej. 1-10"
                      onChange={(e) =>
                        setRanges(ranges.map((x, j) => (j === i ? e.target.value : x)))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="hint" style={{ marginTop: 12 }}>
                Escribe los rangos de páginas de cada parte (ej. <code>1-10</code> o páginas sueltas como{' '}
                <code>4</code>).
              </div>
            </div>
          )}

          <div className="actionbar">
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={run}>
              {busy ? (
                <>
                  <span className="spinner" /> Procesando…
                </>
              ) : mode === 'hacienda' ? (
                <>
                  {Ic.dividir} Dividir para Hacienda (1 MB)
                </>
              ) : manualCriterion === 'size' ? (
                <>
                  {Ic.dividir} Dividir en partes de máx. {maxSize} MB
                </>
              ) : manualCriterion === 'parts' ? (
                <>
                  {Ic.dividir} Dividir en {partCount} partes
                </>
              ) : (
                <>
                  {Ic.dividir} Dividir según rangos
                </>
              )}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={reset}>
              Cambiar documento
            </button>
          </div>
        </>
      )}

      {/* 5. Resultados (Stage: Result) */}
      {stage === 'result' && (
        <>
          <div className={`banner${oversized.length ? ' warn' : ''}`}>
            <span
              style={{
                flex: 'none',
                width: 26,
                height: 26,
                color: oversized.length ? 'var(--warn)' : 'var(--good)',
              }}
            >
              {oversized.length ? Ic.warn : Ic.check}
            </span>
            <div className="txt">
              <strong>
                {oversized.length
                  ? `${valid.length} archivo(s), ${oversized.length} aún sobre ${targetMb} MB.`
                  : `Listo — ${valid.length} archivo(s) generados.`}
              </strong>
              <p>
                {compressed.length
                  ? `${valid.length - compressed.length} parte(s) intactas (calidad original), ${compressed.length} comprimida(s).`
                  : 'Todas las partes conservan su calidad original.'}
                {errored.length
                  ? ` ${errored.length} rango(s) inválido(s): ${errored.map((p) => p.range).join(', ')}.`
                  : ''}
              </p>
            </div>
            {valid.length > 0 && (
              <button className="btn btn-primary" onClick={downloadAll}>
                {Ic.download} Descargar todo (.zip)
              </button>
            )}
          </div>

          <div className="result-grid">
            {valid.map((p, i) => (
              <div className="card rcard" key={p.index}>
                <PdfThumb b64={p.content_b64} label={`pág. ${p.range}`} />
                <div className="rmeta">
                  <div className="nm" title={p.filename}>
                    {p.filename}
                    <small>{p.compressed ? 'Comprimida' : 'Sin comprimir'}</small>
                  </div>
                  <span className={`chip tnum ${p.oversized ? 'warn' : 'good'}`}>
                    {formatSize(p.size_mb)}
                  </span>
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ width: '100%' }}
                  onClick={() =>
                    p.content_b64 && downloadBlob(b64ToPdfBlob(p.content_b64), p.filename)
                  }
                >
                  {Ic.download} Descargar {i + 1}
                </button>
              </div>
            ))}
          </div>

          <div className="actionbar">
            <button className="btn btn-ghost" onClick={() => setStage('loaded')}>
              Ajustar cortes
            </button>
            <button className="btn btn-ghost" onClick={reset}>
              Empezar de nuevo
            </button>
          </div>
        </>
      )}
    </section>
  )
}
