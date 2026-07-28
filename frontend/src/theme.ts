import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'nahualpdf-theme'

/**
 * Tema de la app. Por defecto **claro** (aunque el SO esté en oscuro), salvo
 * que el usuario haya elegido otro — se recuerda en localStorage. Estampa
 * `data-theme` en <html>, que gana sobre la media query de prefers-color-scheme.
 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(KEY)
    return saved === 'dark' || saved === 'light' ? saved : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(KEY, theme)
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  return [theme, toggle]
}
