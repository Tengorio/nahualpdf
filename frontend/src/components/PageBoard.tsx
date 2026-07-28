import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Ic } from '../icons'
import type { BoardSize } from '../types'
import { PageThumb } from './PageThumb'

export interface PageItem {
  id: string
  fileIndex: number
  file: File
  page: number
  included: boolean
  rotation: number // 0 | 90 | 180 | 270, se suma a la que ya trae el PDF
  sourceLabel: string
  colorIdx: number
}

export function PageBoard({
  items, onReorder, onToggle, onRemove, onRotate, size = 'md',
}: {
  items: PageItem[]
  onReorder: (items: PageItem[]) => void
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onRotate?: (id: string) => void
  size?: BoardSize
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.id === active.id)
    const to = items.findIndex((i) => i.id === over.id)
    if (from !== -1 && to !== -1) onReorder(arrayMove(items, from, to))
  }

  // Índice mostrado = posición entre las páginas incluidas.
  let pos = 0
  const order = new Map<string, number>()
  items.forEach((it) => { if (it.included) order.set(it.id, ++pos) })

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className={`pageboard sz-${size}`}>
          {items.map((it) => (
            <SortableCard
              key={it.id} item={it} orderNo={order.get(it.id)}
              onToggle={onToggle} onRemove={onRemove} onRotate={onRotate}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableCard({
  item, orderNo, onToggle, onRemove, onRotate,
}: {
  item: PageItem
  orderNo?: number
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onRotate?: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 5 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  }
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <div
      ref={setNodeRef} style={style}
      className={`pcard c${item.colorIdx % 6}${item.included ? '' : ' excluded'}${isDragging ? ' dragging' : ''}`}
      {...attributes} {...listeners}
      onKeyDown={(e) => {
        // Enter/Espacio los usa dnd-kit para levantar/soltar; el resto es nuestro.
        if (e.key === 'Delete') { e.preventDefault(); onRemove(item.id) }
        if ((e.key === 'r' || e.key === 'R') && onRotate) { e.preventDefault(); onRotate(item.id) }
      }}
      aria-label={
        `${item.sourceLabel}, página ${item.page}` +
        (item.rotation ? `, girada ${item.rotation} grados` : '') +
        (item.included ? `, posición ${orderNo}` : ', excluida')
      }
    >
      <div className="pcard-top">
        <span className="ord tnum">{item.included ? orderNo : '—'}</span>
        <div className="pcard-btns">
          {onRotate && (
            <button className="iconbtn" title="Girar 90° (tecla R)"
              onPointerDown={stop} onClick={(e) => { stop(e); onRotate(item.id) }}>
              {Ic.rotate}
            </button>
          )}
          <button className="iconbtn" title={item.included ? 'Excluir página' : 'Incluir página'}
            onPointerDown={stop} onClick={(e) => { stop(e); onToggle(item.id) }}>
            {item.included ? Ic.check : Ic.plus}
          </button>
          <button className="iconbtn danger" title="Quitar página (tecla Supr)"
            onPointerDown={stop} onClick={(e) => { stop(e); onRemove(item.id) }}>
            {Ic.trash}
          </button>
        </div>
      </div>
      <div className="thumbwrap">
        <PageThumb file={item.file} page={item.page} rotation={item.rotation} />
        {item.rotation !== 0 && <span className="rotbadge tnum">{item.rotation}°</span>}
      </div>
      <div className="pcard-foot">
        <span className="src" title={item.sourceLabel}>{item.sourceLabel}</span>
        <span className="pg mono tnum">p.{item.page}</span>
      </div>
    </div>
  )
}
