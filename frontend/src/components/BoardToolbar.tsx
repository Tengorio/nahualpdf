import { Ic } from '../icons'
import type { BoardSize } from '../types'
import type { PageItem } from './PageBoard'

/**
 * Acciones que operan sobre TODO el tablero. Se comparten entre Unir y
 * Organizar: cuando hay 200 páginas, tocarlas una por una no es opción.
 */
export function BoardToolbar({
  items, setItems, size, setSize, onAddFiles,
}: {
  items: PageItem[]
  setItems: (items: PageItem[]) => void
  size: BoardSize
  setSize: (s: BoardSize) => void
  onAddFiles?: (files: File[]) => void
}) {
  const included = items.filter((it) => it.included).length
  const allIn = included === items.length && items.length > 0
  const rotated = items.some((it) => it.rotation !== 0)

  const map = (fn: (it: PageItem) => PageItem) => setItems(items.map(fn))

  return (
    <div className="board-toolbar">
      <div className="rowflex wrap">
        <span className="chip good tnum">{included} de {items.length} página(s)</span>

        <div className="btngroup">
          <button className="btn btn-ghost btn-sm"
            title={allIn ? 'Excluir todas las páginas' : 'Incluir todas las páginas'}
            onClick={() => map((it) => ({ ...it, included: !allIn }))}>
            {allIn ? 'Excluir todas' : 'Incluir todas'}
          </button>
          <button className="btn btn-ghost btn-sm" title="Invertir el orden de las páginas"
            onClick={() => setItems([...items].reverse())}>
            Invertir orden
          </button>
          <button className="btn btn-ghost btn-sm" title="Girar 90° todas las páginas"
            onClick={() => map((it) => ({ ...it, rotation: (it.rotation + 90) % 360 }))}>
            {Ic.rotate} Girar todas
          </button>
          {rotated && (
            <button className="btn btn-ghost btn-sm" title="Quitar todos los giros aplicados"
              onClick={() => map((it) => ({ ...it, rotation: 0 }))}>
              {Ic.undo} Sin giros
            </button>
          )}
        </div>
      </div>

      <div className="rowflex">
        <div className="seg seg-sm" role="group" aria-label="Tamaño de las miniaturas">
          {(['sm', 'md', 'lg'] as BoardSize[]).map((s) => (
            <button key={s} className={size === s ? 'on' : ''} onClick={() => setSize(s)}
              title={`Miniaturas ${s === 'sm' ? 'pequeñas' : s === 'md' ? 'medianas' : 'grandes'}`}>
              {s === 'sm' ? 'S' : s === 'md' ? 'M' : 'L'}
            </button>
          ))}
        </div>
        {onAddFiles && (
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            {Ic.plus} Agregar más
            <input type="file" accept="application/pdf" hidden multiple
              onChange={(e) => { if (e.target.files) onAddFiles(Array.from(e.target.files)); e.target.value = '' }} />
          </label>
        )}
      </div>
    </div>
  )
}

/** Pista de atajos, igual en ambos tableros. */
export function BoardHints() {
  return (
    <p className="hint boardhints">
      Arrastra para reordenar · <b>Tab</b> + <b>Espacio</b> mueve con teclado · <b>R</b> gira · <b>Supr</b> quita
    </p>
  )
}
