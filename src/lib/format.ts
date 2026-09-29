const dh = new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 })
const dh2 = new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const money = (n: number, decimals = false) => `${(decimals ? dh2 : dh).format(n)} DH`
export const num = (n: number) => dh.format(n)
export const pct = (n: number, d = 1) => `${n.toFixed(d).replace('.', ',')} %`

export const DAY = 86_400_000
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
export const daysFromNow = (n: number) => new Date(today().getTime() + n * DAY)
export const iso = (d: Date) => d.toISOString()
export const isoDay = (d: Date | string) => new Date(d).toISOString().slice(0, 10)
export const daysUntil = (d: string) => Math.round((new Date(d).getTime() - today().getTime()) / DAY)
export const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / DAY)

export const date = (d: string | Date, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  new Date(d).toLocaleDateString('fr-FR', opts)
export const dateTime = (d: string | Date) =>
  new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
export const relative = (d: string) => {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.round(h / 24)
  return j === 1 ? 'hier' : `il y a ${j} j`
}

export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`
export const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + f(x), 0)
export const groupBy = <T,>(arr: T[], f: (x: T) => string) =>
  arr.reduce<Record<string, T[]>>((acc, x) => ((acc[f(x)] ||= []).push(x), acc), {})

// Deterministic PRNG so seeded demo data is stable across reloads.
export function rng(seed: number) {
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (a: number, b: number) => Math.floor(next() * (b - a + 1)) + a,
    pick: <T,>(arr: T[]) => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  }
}

export function toCSV(rows: Record<string, string | number>[]) {
  if (!rows.length) return ''
  const head = Object.keys(rows[0])
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [head.join(';'), ...rows.map((r) => head.map((h) => esc(r[h])).join(';'))].join('\n')
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, '').split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const sep = lines[0].includes(';') ? ';' : ','
  const split = (l: string) => {
    const out: string[] = []
    let cur = '', q = false
    for (let i = 0; i < l.length; i++) {
      const c = l[i]
      if (c === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++ } else q = !q }
      else if (c === sep && !q) { out.push(cur); cur = '' }
      else cur += c
    }
    out.push(cur)
    return out
  }
  const head = split(lines[0]).map((h) => h.trim())
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v.trim()])))
}

export function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
