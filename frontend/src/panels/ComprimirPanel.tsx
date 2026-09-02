import { useState } from 'react'
import type { CompressResult, PdfInfo, Stage } from '../types'
import { b64ToPdfBlob, compress, downloadBlob, fetchPdfInfo } from '../api'
import { errMsg, formatSize } from '../util'
import { Ic } from '../icons'
import { Dropzone, ErrorNote, Stepper } from '../components/common'
import { PdfThumb } from '../components/PdfThumb'

export type CompressMode = 'hacienda' | 'manual'
export type CompressCriterion = 'size' | 'quality' | 'text'

interface QualityPreset {
  id: 'low' | 'med' | 'high'
  label: string
  desc: string
  dpi: number
  quality: number
}

const QUALITY_PRESETS: QualityPreset[] = [
  { id: 'low', label: 'Baja compresión', desc: 'Máxima calidad y nitidez (200 DPI, 85%)', dpi: 200, quality: 85 },
  { id: 'med', label: 'Media compresión', desc: 'Equilibrio óptimo peso/calidad (150 DPI, 75%)', dpi: 150, quality: 75 },
  { id: 'high', label: 'Alta compresión', desc: 'Máxima reducción de peso (100 DPI, 60%)', dpi: 100, quality: 60 },
]

export function ComprimirPanel() {
  const [stage, setStage] = useState<Stage>('empty')
  const [file, setFile] = useState<File | null>(null)
  const [info, setInfo] = useState<PdfInfo | null>(null)

  // Modo principal: Hacienda vs Manual
  const [mode, setMode] = useState<CompressMode>('hacienda')

  // Submenú en modo Manual: qué variable se fija (solo una de las tres)
  const [criterion, setCriterion] = useState<CompressCriterion>('size')

  // Variable 1: Tamaño objetivo (MB)
  const [maxSize, setMaxSize] = useState(2)

  // Variable 2: Nivel de calidad
  const [qualityPreset, setQualityPreset] = useState<'low' | 'med' | 'high'>('med')

  // Variable 3: Tratamiento de texto
  const [textStrategy, setTextStrategy] = useState<'preserve' | 'rasterize'>('preserve')

  const [result, setResult] = useState<CompressResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPick = async (f: File) => {
    setError(null)
    setBusy(true)
    try {
      const meta = await fetchPdfInfo(f)
      setFile(f)
      setInfo(meta)
      setResult(null)
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
      let res: CompressResult
      if (mode === 'hacienda') {
        // Modo Hacienda: fijado estrictamente en 1.0 MB
        res = await compress(file, { maxSizeMb: 1.0, preserveText: true })
      } else {
        // Modo Manual según criterio único elegido
        if (criterion === 'size') {
          res = await compress(file, { maxSizeMb: maxSize, preserveText: true })
        } else if (criterion === 'quality') {
          const q = QUALITY_PRESETS.find((p) => p.id === qualityPreset) ?? QUALITY_PRESETS[1]
          res = await compress(file, { maxSizeMb: 0.1, dpi: q.dpi, quality: q.quality, preserveText: true })
        } else {
          // 'text'
          const shouldPreserve = textStrategy === 'preserve'
          res = await compress(file, { maxSizeMb: 1.0, preserveText: shouldPreserve })
        }
      }
      setResult(res)
      setStage('result')
    } catch (e) {
      setError(errMsg(e, 'Falló la compresión.'))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setStage('empty')
    setFile(null)
    setInfo(null)
    setResult(null)
    setError(null)
  }

  const stepN = stage === 'empty' ? 1 : stage === 'loaded' ? 2 : 3
  const reduction = result ? result.original_size_mb - result.size_mb : 0
  const pct = result && result.original_size_mb > 0 ? (reduction / result.original_size_mb) * 100 : 0
  const targetMb = mode === 'hacienda' ? 1.0 : criterion === 'size' ? maxSize : 0
  const selectedQuality = QUALITY_PRESETS.find((p) => p.id === qualityPreset) ?? QUALITY_PRESETS[1]

  return (
    <section className="panel">
      <div className="head">
        <h1>Comprimir a un límite</h1>
        <p>
          Reduce el peso de un PDF para cumplir con plataformas de Hacienda (SAT, DOF, PEF) o fija la
          variable de compresión que prefieras.
        </p>
      </div>

      <Stepper n={stepN} />
      {error && <ErrorNote msg={error} />}

      {/* 1. Selector de modo principal */}
      {stage !== 'result' && (
        <div className="card ctl" style={{ marginBottom: 16 }}>
          <div className="lbl">Objetivo de compresión</div>
          <div className="seg" style={{ width: '100%', display: 'flex' }}>
            <button
              type="button"
              style={{ flex: 1, textAlign: 'center', padding: '10px 14px' }}
              className={mode === 'hacienda' ? 'on' : ''}
              onClick={() => setMode('hacienda')}
            >
              Comprimir para Hacienda (1 MB fijo)
            </button>
            <button
              type="button"
              style={{ flex: 1, textAlign: 'center', padding: '10px 14px' }}
              className={mode === 'manual' ? 'on' : ''}
              onClick={() => setMode('manual')}
            >
              Comprimir manualmente
            </button>
          </div>

          {mode === 'hacienda' && (
            <div className="hint" style={{ marginTop: 12, lineHeight: 1.5 }}>
              <b>Estándar Hacienda (SAT, DOF, PEF):</b> reduce el documento automáticamente a un máximo
              de <b>1.0 MB</b>. Preserva el texto seleccionable siempre que sea posible y ajusta la
              resolución justa para no pixelear de más.
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
              className={criterion === 'size' ? 'on' : ''}
              onClick={() => setCriterion('size')}
            >
              1. Tamaño objetivo (MB)
            </button>
            <button
              type="button"
              style={{ flex: 1, textAlign: 'center', padding: '8px 10px', fontSize: 13 }}
              className={criterion === 'quality' ? 'on' : ''}
              onClick={() => setCriterion('quality')}
            >
              2. Nivel de compresión
            </button>
            <button
              type="button"
              style={{ flex: 1, textAlign: 'center', padding: '8px 10px', fontSize: 13 }}
              className={criterion === 'text' ? 'on' : ''}
              onClick={() => setCriterion('text')}
            >
              3. Tratamiento de texto
            </button>
          </div>

          {/* Detalle de la variable seleccionada */}
          <div style={{ marginTop: 14 }}>
            {criterion === 'size' && (
              <div>
                <div className="rowflex wrap">
                  <span className="hint" style={{ margin: 0, fontWeight: 550, color: 'var(--ink)' }}>
                    Límite objetivo de peso:
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
                  <b>La interfaz optimiza el resto:</b> calcula la compresión necesaria para alcanzar{' '}
                  <b>{maxSize} MB</b> preservando el texto nítido.
                </div>
              </div>
            )}

            {criterion === 'quality' && (
              <div>
                <div className="rowflex wrap">
                  <span className="hint" style={{ margin: 0, fontWeight: 550, color: 'var(--ink)' }}>
                    Perfil de compresión:
                  </span>
                  <div className="seg">
                    {QUALITY_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={qualityPreset === p.id ? 'on' : ''}
                        onClick={() => setQualityPreset(p.id)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="hint" style={{ marginTop: 8 }}>
                  <b>Perfil aplicado:</b> {selectedQuality.desc}.
                </div>
              </div>
            )}

            {criterion === 'text' && (
              <div>
                <div className="rowflex wrap">
                  <span className="hint" style={{ margin: 0, fontWeight: 550, color: 'var(--ink)' }}>
                    Estrategia de texto:
                  </span>
                  <div className="seg">
                    <button
                      type="button"
                      className={textStrategy === 'preserve' ? 'on' : ''}
                      onClick={() => setTextStrategy('preserve')}
                    >
                      Preservar texto vectorial
                    </button>
                    <button
                      type="button"
                      className={textStrategy === 'rasterize' ? 'on' : ''}
                      onClick={() => setTextStrategy('rasterize')}
                    >
                      Rasterizar todo (Máxima reducción)
                    </button>
                  </div>
                </div>
                <div className="hint" style={{ marginTop: 8 }}>
                  {textStrategy === 'preserve' ? (
                    <>
                      <b>Texto intacto:</b> solo comprime páginas escaneadas; el texto nativo se mantiene
                      seleccionable y sin pixeleo.
                    </>
                  ) : (
                    <>
                      <b>Reducción total:</b> convierte todo a imagen optimizada para lograr el menor peso
                      posible (el texto deja de ser seleccionable).
                    </>
                  )}
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
          title="Arrastra tu PDF para comprimirlo"
          sub={
            mode === 'hacienda'
              ? 'Se comprimirá automáticamente para plataformas de Hacienda (máx. 1.0 MB). Todo local; nada sale a internet.'
              : criterion === 'size'
              ? `Se comprimirá para alcanzar un límite de ${maxSize} MB. Todo local; nada sale a internet.`
              : criterion === 'quality'
              ? `Se comprimirá con perfil ${selectedQuality.label}. Todo local; nada sale a internet.`
              : `Se comprimirá ${textStrategy === 'preserve' ? 'preservando texto vectorial' : 'rasterizando todo'}. Todo local; nada sale a internet.`
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

          {targetMb > 0 && info.size_mb <= targetMb && (
            <div className="note accent">
              {Ic.info}
              El archivo ya pesa <b>{formatSize(info.size_mb)}</b>, por debajo del objetivo de{' '}
              <b>{targetMb} MB</b>. Puedes comprimirlo aún más o descargarlo tal cual.
            </div>
          )}

          <div className="actionbar">
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={run}>
              {busy ? (
                <>
                  <span className="spinner" /> Comprimiendo…
                </>
              ) : mode === 'hacienda' ? (
                <>
                  {Ic.comprimir} Comprimir para Hacienda (1 MB)
                </>
              ) : criterion === 'size' ? (
                <>
                  {Ic.comprimir} Comprimir a máx. {maxSize} MB
                </>
              ) : criterion === 'quality' ? (
                <>
                  {Ic.comprimir} Comprimir ({selectedQuality.label})
                </>
              ) : (
                <>
                  {Ic.comprimir} Comprimir ({textStrategy === 'preserve' ? 'Preservar texto' : 'Rasterizar todo'})
                </>
              )}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={reset}>
              Cambiar documento
            </button>
          </div>
        </>
      )}

      {/* 5. Resultado (Stage: Result) */}
      {stage === 'result' && result && (
        <>
          <div className={`banner${result.oversized ? ' warn' : ''}`}>
            <span
              style={{
                flex: 'none',
                width: 26,
                height: 26,
                color: result.oversized ? 'var(--warn)' : 'var(--good)',
              }}
            >
              {result.oversized ? Ic.warn : Ic.check}
            </span>
            <div className="txt">
              <strong>
                {result.oversized
                  ? `Reducido a ${formatSize(result.size_mb)} — aún sobre el objetivo de ${maxSize} MB.`
                  : `Listo — ${formatSize(result.size_mb)} (${result.compressed ? `−${pct.toFixed(0)}%` : 'sin cambios'}).`}
              </strong>
              <p>
                {result.compressed
                  ? `De ${formatSize(result.original_size_mb)} a ${formatSize(result.size_mb)} (−${pct.toFixed(0)}%).`
                  : 'El documento ya cumplía el objetivo sin necesidad de compresión.'}
                {result.oversized
                  ? ' Preservando el texto no se pudo reducir más; prueba cambiar el modo de texto a rasterizar todo.'
                  : ''}
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() =>
                downloadBlob(b64ToPdfBlob(result.content_b64), result.filename)
              }
            >
              {Ic.download} Descargar
            </button>
          </div>

          <div className="result-grid">
            <div className="card rcard">
              <PdfThumb b64={result.content_b64} label={`${info?.num_pages ?? 1} pág.`} />
              <div className="rmeta">
                <div className="nm" title={result.filename}>
                  {result.filename}
                  <small>{result.compressed ? 'Comprimido' : 'Sin comprimir'}</small>
                </div>
                <span className={`chip tnum ${result.oversized ? 'warn' : 'good'}`}>
                  {formatSize(result.size_mb)}
                </span>
              </div>
              <button
                className="btn btn-ghost"
                style={{ width: '100%' }}
                onClick={() =>
                  downloadBlob(b64ToPdfBlob(result.content_b64), result.filename)
                }
              >
                {Ic.download} Descargar
              </button>
            </div>
          </div>

          <div className="actionbar">
            <button className="btn btn-ghost" onClick={() => setStage('loaded')}>
              Ajustar parámetros
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
