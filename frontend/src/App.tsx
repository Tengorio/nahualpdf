import { useState } from 'react'
import type { Tool } from './types'
import { Ic } from './icons'
import { useTheme } from './theme'
import { ReorganizarPanel } from './panels/ReorganizarPanel'
import { DividirPanel } from './panels/DividirPanel'
import { ComprimirPanel } from './panels/ComprimirPanel'

const TOOLS: { id: Tool; name: string; sub: string }[] = [
  { id: 'reorganizar', name: 'Reorganizar o unir', sub: 'Combinar, ordenar y girar' },
  { id: 'dividir', name: 'Dividir', sub: 'Para Hacienda o por rangos' },
  { id: 'comprimir', name: 'Comprimir', sub: 'Reducir a un límite' },
]

export default function App() {
  const [tool, setTool] = useState<Tool>('reorganizar')
  const [theme, toggleTheme] = useTheme()

  return (
    <div className="app">
      <div className="brand">
        <div className="glyph">{Ic.logo}</div>
        <div>
          <div className="word">
            Nahual<b>PDF</b>
          </div>
          <div className="sub">Transforma expedientes y documentos</div>
        </div>
      </div>

      <div className="topbar">
        <span className="trust">
          {Ic.lock} Red local de Secihti · los archivos nunca salen a internet
        </span>
        <button
          className="themebtn"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
          aria-label="Cambiar tema"
        >
          {theme === 'light' ? Ic.moon : Ic.sun}
        </button>
      </div>

      <nav className="rail">
        <div className="cap">Herramientas</div>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`toolbtn${tool === t.id ? ' active' : ''}`}
            onClick={() => setTool(t.id)}
          >
            <span className="ic">{Ic[t.id]}</span>
            <span className="lbl">
              {t.name}
              <small>{t.sub}</small>
            </span>
          </button>
        ))}
        <div className="spacer" />
        <div className="themehint">NahualPDF · Secihti</div>
      </nav>

      <main className="main">
        {(tool === 'reorganizar' || tool === 'unir' || tool === 'organizar') && <ReorganizarPanel />}
        {tool === 'dividir' && <DividirPanel />}
        {tool === 'comprimir' && <ComprimirPanel />}
        <div className="footnote">
          NahualPDF — procesamiento 100% en el servidor local. Ningún archivo sale a internet.
        </div>
      </main>
    </div>
  )
}
