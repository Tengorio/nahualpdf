import { useRef, useState, type ReactNode } from 'react'
import { Ic } from '../icons'
import { formatSize } from '../util'

/* Barra de pasos Subir → Configurar → Descargar */
export function Stepper({ n }: { n: number }) {
  const steps = ['Subir', 'Configurar', 'Descargar']
  return (
    <div className="step-strip" style={{ marginBottom: 20 }}>
      {steps.map((s, i) => {
        const num = i + 1
        const cls = num < n ? 'done' : num === n ? 'active' : ''
        return (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className={`step ${cls}`}><span className="dot">{num}</span>{s}</span>
            {i < steps.length - 1 && <span className="arm" />}
          </span>
        )
      })}
    </div>
  )
}

/* Zona de arrastrar/soltar reutilizable. */
export function Dropzone({
  onFiles, multiple = false, busy = false, title, sub, cta,
}: {
  onFiles: (files: File[]) => void
  multiple?: boolean
  busy?: boolean
  title: string
  sub: string
  cta: string
}) {
  const [hot, setHot] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const take = (list: FileList | null) => {
    if (!list || list.length === 0) return
    onFiles(Array.from(list))
  }

  return (
    <div
      className={`drop${hot ? ' hot' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setHot(true) }}
      onDragLeave={() => setHot(false)}
      onDrop={(e) => { e.preventDefault(); setHot(false); take(e.dataTransfer.files) }}
    >
      <div className="ring">{Ic.upload}</div>
      <h3>{title}</h3>
      <p>{sub}</p>
      <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <><span className="spinner" /> Leyendo…</> : cta}
      </button>
      <input
        ref={inputRef} type="file" accept="application/pdf" hidden multiple={multiple}
        onChange={(e) => { take(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}

/* Nota de error uniforme. */
export function ErrorNote({ msg }: { msg: string }) {
  return <div className="note crit" style={{ marginBottom: 16 }}>{Ic.warn}{msg}</div>
}

/* Control de límite de tamaño: casilla + presets + valor libre. */
export function SizeLimitControl({
  enabled, setEnabled, value, setValue, label,
}: {
  enabled: boolean
  setEnabled: (v: boolean) => void
  value: number
  setValue: (v: number) => void
  label: string
}) {
  return (
    <div className="card ctl" style={{ marginTop: 18 }}>
      <label className="rowflex" style={{ cursor: 'pointer', fontSize: 13 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        {label}
      </label>
      {enabled && (
        <div className="hint rowflex wrap" style={{ marginTop: 10 }}>
          Objetivo:
          <div className="seg">
            {[1, 2].map((v) => (
              <button key={v} className={value === v ? 'on' : ''} onClick={() => setValue(v)}>
                {v} MB{v === 1 ? ' · Hacienda' : ''}
              </button>
            ))}
          </div>
          <input className="num tnum" type="number" min={0.1} step={0.1} value={value}
            onChange={(e) => setValue(Math.max(0.1, Number(e.target.value) || 0.1))} /> MB
        </div>
      )}
    </div>
  )
}

/* Resultado de un solo archivo (unir / organizar): banner + tarjeta + acciones. */
export function SingleResult({
  result, okTitle, onDownload, onBack, onReset, children,
}: {
  result: { filename: string; num_pages: number; size_mb: number; compressed: boolean; oversized: boolean }
  okTitle: string
  onDownload: () => void
  onBack: () => void
  onReset: () => void
  children?: ReactNode
}) {
  return (
    <>
      <div className={`banner${result.oversized ? ' warn' : ''}`}>
        <span style={{ flex: 'none', width: 26, height: 26, color: result.oversized ? 'var(--warn)' : 'var(--good)' }}>
          {result.oversized ? Ic.warn : Ic.check}
        </span>
        <div className="txt">
          <strong>
            {result.oversized
              ? `${okTitle} (${result.num_pages} páginas) — ${formatSize(result.size_mb)}, sobre el objetivo.`
              : `Listo — ${result.num_pages} páginas en un archivo de ${formatSize(result.size_mb)}.`}
          </strong>
          <p>{result.compressed ? 'Se comprimió para cumplir el límite.' : 'Sin compresión: calidad original.'}</p>
        </div>
        <button className="btn btn-primary" onClick={onDownload}>{Ic.download} Descargar</button>
      </div>
      {children}
      <div className="actionbar">
        <button className="btn btn-ghost" onClick={onBack}>Ajustar</button>
        <button className="btn btn-ghost" onClick={onReset}>Empezar de nuevo</button>
      </div>
    </>
  )
}
