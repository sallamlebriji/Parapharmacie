import { DAY, today } from './format'
import { orderMargin } from './logic'
import type { Order } from './types'

export type Granularity = 'jour' | 'semaine' | 'mois'

const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)

export function bucketKey(date: Date, g: Granularity) {
  const d = g === 'jour' ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : g === 'semaine' ? startOfWeek(date) : startOfMonth(date)
  return d.getTime()
}

export function bucketLabel(t: number, g: Granularity) {
  const d = new Date(t)
  if (g === 'mois') return d.toLocaleDateString('fr-FR', { month: 'short' })
  if (g === 'semaine') return 'S. ' + d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

/** Empty buckets spanning the period so charts have no gaps. */
export function buckets(g: Granularity, count: number) {
  const out: number[] = []
  const t = today()
  for (let i = count - 1; i >= 0; i--) {
    const d = g === 'jour' ? new Date(t.getTime() - i * DAY) : g === 'semaine' ? new Date(startOfWeek(t).getTime() - i * 7 * DAY) : new Date(t.getFullYear(), t.getMonth() - i, 1)
    out.push(bucketKey(d, g))
  }
  return out
}

export function seriesBy<T extends Record<string, number>>(orders: Order[], g: Granularity, count: number, init: () => T, add: (acc: T, o: Order) => void) {
  const keys = buckets(g, count)
  const map = new Map(keys.map((k) => [k, init()]))
  orders.forEach((o) => { const acc = map.get(bucketKey(new Date(o.createdAt), g)); if (acc) add(acc, o) })
  return keys.map((k) => ({ label: bucketLabel(k, g), t: k, ...map.get(k)! }))
}

export const revenueSeries = (orders: Order[], g: Granularity, count: number) =>
  seriesBy(orders, g, count, () => ({ ca: 0, marge: 0, commandes: 0, web: 0, pos: 0 }), (a, o) => {
    a.ca += o.total - o.shipping
    a.marge += orderMargin(o)
    a.commandes += 1
    if (o.channel === 'web') a.web += 1; else a.pos += 1
  }).map((r) => ({ ...r, ca: Math.round(r.ca), marge: Math.round(r.marge), tauxMarge: r.ca ? Math.round((r.marge / r.ca) * 1000) / 10 : 0 }))

export const RANGES = [
  { id: '7', label: '7 jours', days: 7, g: 'jour' as Granularity, count: 7 },
  { id: '30', label: '30 jours', days: 30, g: 'jour' as Granularity, count: 30 },
  { id: '90', label: '90 jours', days: 90, g: 'semaine' as Granularity, count: 13 },
  { id: '180', label: '6 mois', days: 180, g: 'mois' as Granularity, count: 6 },
]
