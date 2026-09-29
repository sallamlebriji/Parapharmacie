import { useSyncExternalStore } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'
const KEY = 'paraflow:theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function readPref(): ThemePref {
  try { return (localStorage.getItem(KEY) as ThemePref) || 'system' } catch { return 'system' }
}
let pref: ThemePref = typeof window === 'undefined' ? 'system' : readPref()

const resolved = (p: ThemePref) => (p === 'system' ? (media().matches ? 'dark' : 'light') : p)

function apply(animate: boolean) {
  const root = document.documentElement
  if (animate) {
    root.classList.add('theme-transition')
    window.setTimeout(() => root.classList.remove('theme-transition'), 450)
  }
  root.dataset.theme = resolved(pref)
}

/** Called once before React renders to avoid a flash of the wrong theme. */
export function initTheme() {
  apply(false)
  media().addEventListener('change', () => { if (pref === 'system') { apply(true); listeners.forEach((l) => l()) } })
}

export function setTheme(p: ThemePref) {
  pref = p
  try { localStorage.setItem(KEY, p) } catch { /* ignore */ }
  apply(true)
  listeners.forEach((l) => l())
}

export function useTheme() {
  const p = useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => pref)
  return { pref: p, resolved: resolved(p) as 'light' | 'dark', setTheme }
}
