import { useEffect, useRef, useState } from 'react'
import { applyTheme, resolveTheme, savedTheme, type Theme } from '../domain/theme'
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(savedTheme(), window.matchMedia('(prefers-color-scheme: dark)').matches))
  const manualChoice = useRef(savedTheme() === 'dark' || savedTheme() === 'light')
  useEffect(() => { applyTheme(theme) }, [theme])
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => { if (!manualChoice.current) setTheme(media.matches ? 'dark' : 'light') }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return <button className="theme-toggle" type="button" onClick={() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    manualChoice.current = true
    setTheme(next)
    try { localStorage.setItem('gaeliza.theme', next) } catch { /* In-memory preference still works. */ }
  }} aria-label={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'escuro'}`}>
    Tema {theme === 'dark' ? 'claro' : 'escuro'}
  </button>
}
