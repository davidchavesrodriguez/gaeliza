export type Theme = 'dark' | 'light'
export function resolveTheme(saved: string | null, prefersDark: boolean): Theme {
  if (saved === 'dark' || saved === 'light') return saved
  return prefersDark ? 'dark' : 'light'
}
export function savedTheme(): string | null {
  try { return localStorage.getItem('gaeliza.theme') } catch { return null }
}
export function applyTheme(theme: Theme) { document.documentElement.dataset.theme = theme }
export function initializeTheme() {
  const theme = resolveTheme(savedTheme(), window.matchMedia('(prefers-color-scheme: dark)').matches)
  applyTheme(theme)
  return theme
}
