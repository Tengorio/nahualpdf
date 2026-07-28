import { useRef, useState } from 'react'
import { Ic } from '../icons'

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
