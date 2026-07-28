import { useState } from 'react'
import type { Tool } from './types'
import { Ic } from './icons'
import { useTheme } from './theme'
import { DividirPanel } from './panels/DividirPanel'
import { ComprimirPanel } from './panels/ComprimirPanel'
import { UnirPanel } from './panels/UnirPanel'
import { OrganizarPanel } from './panels/OrganizarPanel'

const TOOLS: { id: Tool; name: string; sub: string }[] = [
  { id: 'dividir', name: 'Dividir', sub: 'Por tamaño o rangos' },
  { id: 'unir', name: 'Unir', sub: 'Combinar y comprimir' },
  { id: 'comprimir', name: 'Comprimir', sub: 'Reducir a un límite' },
  { id: 'organizar', name: 'Organizar', sub: 'Reordenar y girar' },
]

export default function App() {
  const [tool, setTool] = useState<Tool>('dividir')
  const [theme, toggleTheme] = useTheme()

  return (
    <div className="app">
      <div className="brand">
        <div className="glyph">m</div>
        <div>
          <div className="word">mini<b>PDF</b></div>
          <div className="sub">Herramientas de expedientes</div>
        </div>
      </div>

      <div className="topbar">
        <span className="trust">{Ic.lock} Red local de Secihti · los archivos nunca salen a internet</span>
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
          <button key={t.id} className={`toolbtn${tool === t.id ? ' active' : ''}`} onClick={() => setTool(t.id)}>
            <span className="ic">{Ic[t.id]}</span>
            <span className="lbl">{t.name}<small>{t.sub}</small></span>
          </button>
        ))}
        <div className="spacer" />
        <div className="themehint">miniPDF v2 · desarrollo local</div>
      </nav>

      <main className="main">
        {tool === 'dividir' && <DividirPanel />}
        {tool === 'unir' && <UnirPanel />}
        {tool === 'comprimir' && <ComprimirPanel />}
        {tool === 'organizar' && <OrganizarPanel />}
        <div className="footnote">
          miniPDF v2 — procesamiento 100% en el servidor local. Ningún archivo sale a internet.
        </div>
      </main>
    </div>
  )
}
