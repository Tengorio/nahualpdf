import { useRef, useState } from 'react'
import JSZip from 'jszip'
import type { HaciendaResult } from '../types'
import { b64ToBytes, b64ToPdfBlob, downloadBlob, prepararHacienda } from '../api'
import { errMsg, formatSize } from '../util'
import { Ic } from '../icons'
import { Dropzone } from '../components/common'

/**
 * Preparar para Hacienda (D-09): se sueltan los PDF y empieza solo. Cada uno
 * sale en partes de 1 MB o menos, sin quitarle nada (solo se re-codifican
 * imágenes, a gris o blanco y negro), con su receta para quien lo revise.
 */
type Estado = 'cola' | 'proceso' | 'listo' | 'error'

interface Item {
  id: number
  file: File
  estado: Estado
  res?: HaciendaResult
  error?: string
  verReceta?: boolean
}

export function HaciendaPanel() {
  const [items, setItems] = useState<Item[]>([])
  const corriendo = useRef(false)
  const cola = useRef<Item[]>([])
  const siguienteId = useRef(1)

  const actualizar = (id: number, cambio: Partial<Item>) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...cambio } : x)))

  // Uno por uno: el servidor es compartido y un CAR pesado tarda medio minuto.
  const procesar = async () => {
    if (corriendo.current) return
    corriendo.current = true
    while (cola.current.length > 0) {
      const it = cola.current.shift()!
      actualizar(it.id, { estado: 'proceso' })
      try {
        const res = await prepararHacienda(it.file)
        actualizar(it.id, { estado: 'listo', res })
      } catch (e) {
        actualizar(it.id, { estado: 'error', error: errMsg(e, 'No se pudo preparar este PDF.') })
      }
    }
    corriendo.current = false
  }

  const agregar = (files: File[]) => {
    const nuevos = files
      .filter((f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf')
      .map((file) => ({ id: siguienteId.current++, file, estado: 'cola' as Estado }))
    if (nuevos.length === 0) return
    setItems((xs) => [...xs, ...nuevos])
    cola.current.push(...nuevos)
    void procesar()
  }

  const listos = items.filter((x) => x.estado === 'listo')
  const pendientes = items.filter((x) => x.estado === 'cola' || x.estado === 'proceso').length
  const errores = items.filter((x) => x.estado === 'error').length
  const totalPartes = listos.reduce((n, x) => n + (x.res?.partes.length ?? 0), 0)

  const descargarTodo = async () => {
    const zip = new JSZip()
    for (const { res } of listos) {
      if (!res) continue
      for (const p of res.partes) zip.file(p.nombre, b64ToBytes(p.content_b64))
      zip.file(`recetas/${res.receta_nombre}`, res.receta_texto)
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, 'listos_para_hacienda.zip')
  }

  const reiniciar = () => {
    if (pendientes > 0) return
    setItems([])
  }

  return (
    <section className="panel">
      <div className="head">
        <h1>Preparar para Hacienda</h1>
        <p>
          Suelta uno o varios PDF y listo: cada uno sale en partes de <b>1 MB o menos</b>, sin quitarle
          nada. Solo se aligeran las imágenes (pasan a gris o a blanco y negro); el texto, los logos, los
          sellos y las firmas se quedan. Si hace falta dividir, se usan las menos partes posibles.
        </p>
      </div>

      {pendientes === 0 && (
        <Dropzone
          multiple
          onFiles={agregar}
          title={items.length ? 'Agregar más PDF' : 'Arrastra aquí los PDF para Hacienda'}
          sub="Puedes soltar varios a la vez. Empiezan solos, uno por uno. Todo local; nada sale a internet."
          cta="Seleccionar PDF"
        />
      )}

      {items.length > 0 && pendientes === 0 && listos.length > 0 && (
        <div className={`banner${errores ? ' warn' : ''}`} style={{ marginTop: 18 }}>
          <span style={{ flex: 'none', width: 26, height: 26, color: errores ? 'var(--warn)' : 'var(--good)' }}>
            {errores ? Ic.warn : Ic.check}
          </span>
          <div className="txt">
            <strong>
              {listos.length} {listos.length === 1 ? 'documento listo' : 'documentos listos'} en {totalPartes}{' '}
              {totalPartes === 1 ? 'archivo' : 'archivos'}
              {errores ? ` · ${errores} con problema` : ''}.
            </strong>
            <p>El zip trae todas las partes y, en la carpeta «recetas», qué se le hizo a cada documento.</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={descargarTodo}>
            {Ic.download} Descargar todo (.zip)
          </button>
          <button className="btn btn-ghost" onClick={reiniciar}>
            Empezar de nuevo
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="filelist hacienda-lista" style={{ marginTop: 18 }}>
          {items.map((it) => (
            <div key={it.id} className="card docbar hacienda-item" data-estado={it.estado}>
              <div className="fileic" />
              <div className="meta">
                <div className="nm">{it.file.name}</div>
                <div className="dt">
                  {it.estado === 'cola' && 'En espera…'}
                  {it.estado === 'proceso' && (
                    <>
                      <span className="spinner" /> Preparando… (los escaneados pesados tardan hasta un minuto)
                    </>
                  )}
                  {it.estado === 'error' && <span style={{ color: 'var(--crit)' }}>{it.error}</span>}
                  {it.estado === 'listo' && it.res && (
                    <>
                      {it.res.num_pages} páginas · de {formatSize(it.res.original_size_mb)} a{' '}
                      {it.res.partes.length === 1
                        ? `un solo archivo de ${formatSize(it.res.partes[0].size_mb)}`
                        : `${it.res.partes.length} partes (la mayor, ${formatSize(
                            Math.max(...it.res.partes.map((p) => p.size_mb)),
                          )})`}
                      {it.res.texto_identico === false && ' · revisar el texto'}
                    </>
                  )}
                </div>
                {it.estado === 'listo' && it.res && (
                  <div className="rowflex wrap" style={{ marginTop: 8, gap: 6 }}>
                    {it.res.partes.map((p, i, todas) => (
                      <button
                        key={p.nombre}
                        className="btn btn-ghost btn-sm"
                        title={p.nombre}
                        onClick={() => downloadBlob(b64ToPdfBlob(p.content_b64), p.nombre)}
                      >
                        {Ic.download} {todas.length === 1 ? 'PDF' : `Parte ${i + 1} de ${todas.length}`} · págs.{' '}
                        {p.paginas}
                      </button>
                    ))}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => actualizar(it.id, { verReceta: !it.verReceta })}
                    >
                      {it.verReceta ? 'Ocultar receta' : 'Ver receta'}
                    </button>
                  </div>
                )}
                {it.verReceta && it.res && <pre className="receta">{it.res.receta_texto}</pre>}
                {it.res?.advertencias.map((a) => (
                  <div key={a} className="note crit" style={{ marginTop: 8 }}>
                    {Ic.warn}
                    {a}
                  </div>
                ))}
              </div>
              <span
                className={`chip tnum ${
                  it.estado === 'listo' ? 'good' : it.estado === 'error' ? 'crit' : 'warn'
                }`}
              >
                {it.estado === 'listo'
                  ? it.res && it.res.partes.length > 1
                    ? `${it.res.partes.length} partes`
                    : 'listo'
                  : it.estado === 'error'
                  ? 'error'
                  : formatSize(it.file.size / (1024 * 1024))}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
