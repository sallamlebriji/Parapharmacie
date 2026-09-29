import { COMPLEMENTS } from '../data/catalog'
import { DAY, daysUntil, iso, sum, uid } from './format'
import type { Customer, Lot, Movement, Order, Pack, Product, Promotion, Tenant, TenantData } from './types'

export type Scope = string // 'all' or a store id

const inScope = (storeId: string, scope: Scope) => scope === 'all' || storeId === scope

/* ───────────────────────────── Stock ───────────────────────────── */

export const lotsOf = (d: TenantData, productId: string, scope: Scope = 'all') =>
  d.lots.filter((l) => l.productId === productId && inScope(l.storeId, scope))

export const physicalStock = (d: TenantData, productId: string, scope: Scope = 'all') =>
  sum(lotsOf(d, productId, scope), (l) => l.qty)

/** Web orders not yet shipped hold stock without having consumed a lot yet. */
export function reservedStock(d: TenantData, productId: string, scope: Scope = 'all') {
  return sum(
    d.orders.filter((o) => o.channel === 'web' && (o.status === 'recue' || o.status === 'preparation') && inScope(o.storeId, scope)),
    (o) => sum(o.items.filter((i) => i.productId === productId), (i) => i.qty),
  )
}

export const availableStock = (d: TenantData, productId: string, scope: Scope = 'all') =>
  d.insights ? d.insights.available[productId] ?? 0 : Math.max(0, physicalStock(d, productId, scope) - reservedStock(d, productId, scope))

export const thresholdFor = (d: TenantData, p: Product, scope: Scope) =>
  p.alertThreshold * (scope === 'all' ? d.stores.length : 1)

export type StockState = 'rupture' | 'faible' | 'ok'
export const stockState = (d: TenantData, p: Product, scope: Scope = 'all'): StockState => stockIndex(d, scope)(p).state

/** One-pass index for list views (avoids re-scanning orders per product). */
export function stockIndex(d: TenantData, scope: Scope = 'all') {
  if (d.insights) {
    const av = d.insights.available
    return (p: Product) => {
      const a = av[p.id] ?? 0
      const state: StockState = a <= 0 ? 'rupture' : a <= p.alertThreshold ? 'faible' : 'ok'
      return { physical: a, reserved: 0, available: a, state }
    }
  }
  const physical = new Map<string, number>()
  const reserved = new Map<string, number>()
  const perStore = new Map<string, number>()
  d.lots.forEach((l) => {
    if (!inScope(l.storeId, scope)) return
    physical.set(l.productId, (physical.get(l.productId) ?? 0) + l.qty)
    perStore.set(l.productId + '|' + l.storeId, (perStore.get(l.productId + '|' + l.storeId) ?? 0) + l.qty)
  })
  d.orders.forEach((o) => {
    if (o.channel !== 'web' || (o.status !== 'recue' && o.status !== 'preparation') || !inScope(o.storeId, scope)) return
    o.items.forEach((i) => reserved.set(i.productId, (reserved.get(i.productId) ?? 0) + i.qty))
  })
  const get = (p: Product) => {
    const phys = physical.get(p.id) ?? 0
    const res = reserved.get(p.id) ?? 0
    const avail = Math.max(0, phys - res)
    // Alerts are per store: in the consolidated view one store under its threshold is enough.
    const storeLow = scope === 'all' && d.stores.some((s) => (perStore.get(p.id + '|' + s.id) ?? 0) <= p.alertThreshold)
    const state: StockState = avail <= 0 ? 'rupture' : avail <= thresholdFor(d, p, scope) || storeLow ? 'faible' : 'ok'
    return { physical: phys, reserved: res, available: avail, state }
  }
  return get
}

export const expiringLots =(d: TenantData, withinDays: number, scope: Scope = 'all') =>
  d.lots
    .filter((l) => l.qty > 0 && inScope(l.storeId, scope) && daysUntil(l.expiresAt) <= withinDays)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))

/** Consume stock First-Expired-First-Out; returns updated lots and the generated movements. */
export function consumeFEFO(lots: Lot[], productId: string, storeId: string, qty: number, type: Movement['type'], note: string, user: string) {
  let remaining = qty
  const moves: Movement[] = []
  const sorted = lots
    .filter((l) => l.productId === productId && l.storeId === storeId && l.qty > 0)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
  const patch = new Map<string, number>()
  for (const l of sorted) {
    if (remaining <= 0) break
    const take = Math.min(l.qty, remaining)
    patch.set(l.id, l.qty - take)
    remaining -= take
    moves.push({ id: uid('mv'), date: iso(new Date()), type, productId, lotId: l.id, storeId, qty: -take, note, user })
  }
  return { lots: lots.map((l) => (patch.has(l.id) ? { ...l, qty: patch.get(l.id)! } : l)), moves, shortfall: remaining }
}

/* ─────────────────────────── Pricing ─────────────────────────── */

export const isLive = (p: Promotion, now = Date.now()) =>
  p.active && new Date(p.startsAt).getTime() <= now && new Date(p.endsAt).getTime() >= now

export interface PriceInfo { price: number; oldPrice?: number; label?: string; endsAt?: string }

export function priceOf(d: TenantData, p: Product): PriceInfo {
  let best: PriceInfo = { price: p.price }
  if (p.promoPrice && p.promoPrice < p.price) best = { price: p.promoPrice, oldPrice: p.price, label: `−${Math.round((1 - p.promoPrice / p.price) * 100)} %` }
  for (const pr of d.promotions) {
    if (!isLive(pr)) continue
    const applies =
      (pr.type === 'categorie' && pr.target === p.category) ||
      (pr.type === 'marque' && pr.target === p.brand) ||
      (pr.type === 'flash' && pr.target === p.id)
    if (!applies) continue
    const price = Math.round(p.price * (1 - pr.value / 100))
    if (price < best.price) best = { price, oldPrice: p.price, label: pr.type === 'flash' ? `Flash −${pr.value} %` : `−${pr.value} %`, endsAt: pr.endsAt }
  }
  return best
}

export const packValue = (d: TenantData, pack: Pack) =>
  sum(pack.productIds, (id) => d.products.find((p) => p.id === id)?.price ?? 0)

export const marginRate = (p: Product) => (p.price - p.purchasePrice) / p.price

/* ─────────────────────────── Cart ─────────────────────────── */

export type CartLine = { kind: 'product'; productId: string; qty: number } | { kind: 'pack'; packId: string; qty: number }

export interface CartOptions { coupon?: string; zoneId?: string; mode?: 'standard' | 'express' | 'retrait'; points?: number; customer?: Customer }

export function computeCart(d: TenantData, tenant: Tenant, lines: CartLine[], opts: CartOptions = {}) {
  const rows = lines.map((l) => {
    if (l.kind === 'pack') {
      const pack = d.packs.find((p) => p.id === l.packId)!
      const value = packValue(d, pack)
      return { line: l, key: `pack:${pack.id}`, name: pack.name, sub: `${pack.productIds.length} produits`, unit: pack.price, old: value, total: pack.price * l.qty, pack, product: undefined as Product | undefined }
    }
    const product = d.products.find((p) => p.id === l.productId)!
    const pi = priceOf(d, product)
    return { line: l, key: product.id, name: product.name, sub: product.brand, unit: pi.price, old: pi.oldPrice, total: pi.price * l.qty, pack: undefined as Pack | undefined, product }
  })
  const subtotal = sum(rows, (r) => r.total)
  const savings = sum(rows, (r) => (r.old ? (r.old - r.unit) * r.line.qty : 0))

  // Buy X get Y promotions apply automatically.
  let bxgy = 0
  const bxgyLabels: string[] = []
  for (const pr of d.promotions.filter((p) => p.type === 'bxgy' && isLive(p))) {
    const row = rows.find((r) => r.product?.id === pr.target)
    if (row && pr.buyX && pr.getY) {
      const free = Math.floor(row.line.qty / (pr.buyX + pr.getY)) * pr.getY
      if (free > 0) { bxgy += free * row.unit; bxgyLabels.push(pr.name) }
    }
  }

  let couponDiscount = 0
  let couponError: string | undefined
  let couponPromo: Promotion | undefined
  if (opts.coupon) {
    const code = opts.coupon.trim().toUpperCase()
    couponPromo = d.promotions.find((p) => p.code?.toUpperCase() === code)
    if (!couponPromo || !isLive(couponPromo)) couponError = 'Code promo invalide ou expiré'
    else if (couponPromo.minAmount && subtotal < couponPromo.minAmount) couponError = `Minimum d’achat : ${couponPromo.minAmount} DH`
    else if (code === 'BIENVENUE10' && opts.customer && d.orders.some((o) => o.customerId === opts.customer!.id)) couponError = 'Réservé à la première commande'
    else couponDiscount = couponPromo.type === 'fixe' ? couponPromo.value : Math.round(((subtotal - bxgy) * couponPromo.value) / 100)
  }

  const afterDiscounts = Math.max(0, subtotal - bxgy - couponDiscount)
  const maxPoints = opts.customer ? Math.min(opts.customer.points, Math.floor((afterDiscounts * 0.5) / tenant.settings.pointValue)) : 0
  const pointsUsed = Math.min(opts.points ?? 0, maxPoints)
  const pointsDiscount = Math.round(pointsUsed * tenant.settings.pointValue)

  const zone = d.zones.find((z) => z.id === opts.zoneId) ?? d.zones[0]
  const mode = opts.mode ?? 'standard'
  const freeShipping = afterDiscounts >= zone.freeAbove
  const shipping = !lines.length || mode === 'retrait' ? 0 : mode === 'express' ? zone.expressFee : freeShipping ? 0 : zone.standardFee
  const total = Math.max(0, afterDiscounts - pointsDiscount + shipping)
  const pointsEarned = Math.floor((total - shipping) * tenant.settings.pointsPerDh)

  return {
    rows, subtotal, savings, bxgy, bxgyLabels, couponDiscount, couponError, couponPromo, pointsUsed, pointsDiscount, maxPoints,
    zone, mode, shipping, freeShipping, remainingForFree: Math.max(0, zone.freeAbove - afterDiscounts), total, pointsEarned,
    count: sum(lines, (l) => l.qty),
  }
}

/** Flatten cart lines (packs expanded, pack price prorated by list price) into order items. */
export function toOrderItems(d: TenantData, lines: CartLine[]) {
  const items: Order['items'] = []
  for (const l of lines) {
    if (l.kind === 'product') {
      const p = d.products.find((x) => x.id === l.productId)!
      items.push({ productId: p.id, qty: l.qty, unitPrice: priceOf(d, p).price, unitCost: p.purchasePrice })
    } else {
      const pack = d.packs.find((x) => x.id === l.packId)!
      const ratio = pack.price / packValue(d, pack)
      pack.productIds.forEach((id) => {
        const p = d.products.find((x) => x.id === id)!
        items.push({ productId: id, qty: l.qty, unitPrice: Math.round(p.price * ratio * 100) / 100, unitCost: p.purchasePrice })
      })
    }
  }
  return items
}

/* ─────────────────────── Customers & loyalty ─────────────────────── */

export const TIERS = [
  { id: 'Basic', min: 0, color: '#9aa09c', bg: '#f1f1ee', perks: ['1 point / 10 DH', 'Offre de bienvenue'] },
  { id: 'Silver', min: 2000, color: '#7d8a92', bg: '#eef1f3', perks: ['1 point / 10 DH', 'Livraison offerte dès 300 DH', 'Ventes privées'] },
  { id: 'Gold', min: 5000, color: '#9f7f45', bg: '#f6eedf', perks: ['Points × 1,5', 'Livraison offerte', 'Échantillons premium', 'Cadeau d’anniversaire'] },
  { id: 'VIP', min: 10000, color: '#3c5143', bg: '#e3ebe4', perks: ['Points × 2', 'Livraison express offerte', 'Conseillère dédiée', 'Avant-premières'] },
] as const
export type TierId = (typeof TIERS)[number]['id']

export function customerStats(d: TenantData, c: Customer) {
  const orders = d.orders.filter((o) => o.customerId === c.id && o.status !== 'annulee').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const spent = sum(orders, (o) => o.total)
  const yearAgo = Date.now() - 365 * DAY
  const spent12 = sum(orders.filter((o) => new Date(o.createdAt).getTime() >= yearAgo), (o) => o.total)
  const tier = [...TIERS].reverse().find((t) => spent12 >= t.min)!
  const next = TIERS[TIERS.indexOf(tier as (typeof TIERS)[number]) + 1]
  const last = orders[0]?.createdAt
  const recent90 = orders.filter((o) => Date.now() - new Date(o.createdAt).getTime() < 90 * DAY).length
  const ageDays = (Date.now() - new Date(c.createdAt).getTime()) / DAY
  let segment: Segment = 'regulier'
  if (tier.id === 'VIP') segment = 'vip'
  else if (ageDays < 30) segment = 'nouveau'
  else if (!last || Date.now() - new Date(last).getTime() > 90 * DAY) segment = 'inactif'
  else if (recent90 < 2) segment = 'occasionnel'
  return { orders, count: orders.length, spent, spent12, avg: orders.length ? spent / orders.length : 0, last, tier, next, segment }
}

export type Segment = 'nouveau' | 'regulier' | 'vip' | 'inactif' | 'occasionnel'
export const SEGMENTS: Record<Segment, { label: string; tone: string }> = {
  nouveau: { label: 'Nouveau', tone: 'sky' },
  regulier: { label: 'Régulier', tone: 'sage' },
  occasionnel: { label: 'Occasionnel', tone: 'neutral' },
  vip: { label: 'VIP', tone: 'gold' },
  inactif: { label: 'Inactif', tone: 'rose' },
}

/* ──────────────────────── Recommendations ──────────────────────── */

export function complementary(d: TenantData, p: Product, n = 4) {
  const subs = COMPLEMENTS[p.subcategory] ?? []
  const scored = d.products
    .filter((x) => x.id !== p.id && x.active)
    .map((x) => {
      let s = 0
      const si = subs.indexOf(x.subcategory)
      if (si >= 0) s += 10 - si * 2
      if (x.category === p.category) s += 2
      s += x.needs.filter((nd) => p.needs.includes(nd)).length * 2
      s += x.skinTypes.filter((st) => p.skinTypes.includes(st)).length * 0.5
      if (x.subcategory === p.subcategory) s -= 4
      return { x, s: s + x.rating / 10 }
    })
    .sort((a, b) => b.s - a.s)
  return scored.slice(0, n).map((s) => s.x)
}

export function boughtTogether(d: TenantData, productId: string, n = 3) {
  if (d.insights) return (d.insights.together[productId] ?? []).slice(0, n).map((id) => d.products.find((p) => p.id === id)!).filter(Boolean)
  const counts = new Map<string, number>()
  for (const o of d.orders) {
    if (o.items.length < 2 || !o.items.some((i) => i.productId === productId)) continue
    o.items.forEach((i) => i.productId !== productId && counts.set(i.productId, (counts.get(i.productId) ?? 0) + 1))
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => d.products.find((p) => p.id === id)!).filter(Boolean)
}

export function similar(d: TenantData, p: Product, n = 4) {
  return d.products
    .filter((x) => x.id !== p.id && (x.subcategory === p.subcategory || (x.category === p.category && x.needs.some((nd) => p.needs.includes(nd)))))
    .slice(0, n)
}

export interface QuizAnswers { skin: string; concern: string; age: string; sensitivity: string; habit: string; budget: string }

export function quizRoutine(d: TenantData, a: QuizAnswers) {
  const budgetCap = a.budget === 'essentiel' ? 180 : a.budget === 'confort' ? 280 : 10_000
  const needs = new Set<string>([a.concern])
  if (a.sensitivity === 'oui') needs.add('sensibilite')
  if (a.age === '45+' || a.age === '35-44') needs.add('anti-age')
  const score = (p: Product) =>
    (p.skinTypes.includes(a.skin) ? 3 : p.skinTypes.length === 0 ? 0 : -2) +
    p.needs.filter((n) => needs.has(n)).length * 4 +
    (a.sensitivity === 'oui' && p.needs.includes('sensibilite') ? 2 : 0) +
    (p.price <= budgetCap ? 1 : -3) +
    p.rating / 5
  const pick = (subs: string[], cats: string[] = ['visage']) =>
    d.products
      .filter((p) => cats.includes(p.category) && subs.includes(p.subcategory))
      .sort((x, y) => score(y) - score(x))[0]
  const steps = [
    { step: 'Nettoyer', product: pick(['Nettoyants']) },
    { step: 'Traiter', product: pick(a.concern === 'imperfections' ? ['Soins ciblés', 'Sérums'] : ['Sérums', 'Anti-âge']) },
    { step: 'Hydrater', product: pick(['Hydratants', 'Anti-âge']) },
    { step: 'Protéger', product: pick(['Visage'], ['solaire']) },
  ]
  if (a.habit === 'complet') steps.splice(1, 0, { step: 'Démaquiller', product: pick(['Démaquillants']) })
  if (a.habit === 'complet' || a.concern === 'imperfections') steps.push({ step: 'Bonus (1–2×/sem.)', product: pick(['Masques', 'Contour yeux']) })
  return steps.filter((s) => s.product) as { step: string; product: Product }[]
}

/* ─────────────────────────── Analytics ─────────────────────────── */

export const orderMargin = (o: Order) => sum(o.items, (i) => (i.unitPrice - i.unitCost) * i.qty) - o.discount
export const validOrders = (d: TenantData, scope: Scope) => d.orders.filter((o) => o.status !== 'annulee' && inScope(o.storeId, scope))

export function ordersInRange(d: TenantData, scope: Scope, fromDaysAgo: number, toDaysAgo = 0) {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const from = start.getTime() - fromDaysAgo * DAY
  const to = start.getTime() - toDaysAgo * DAY + DAY
  return validOrders(d, scope).filter((o) => { const t = new Date(o.createdAt).getTime(); return t >= from && t < to })
}

export function productSales(orders: Order[]) {
  const m = new Map<string, { qty: number; revenue: number; margin: number }>()
  orders.forEach((o) => o.items.forEach((i) => {
    const e = m.get(i.productId) ?? { qty: 0, revenue: 0, margin: 0 }
    e.qty += i.qty; e.revenue += i.qty * i.unitPrice; e.margin += i.qty * (i.unitPrice - i.unitCost)
    m.set(i.productId, e)
  }))
  return m
}

export function variation(cur: number, prev: number) {
  if (!prev) return 0
  return ((cur - prev) / prev) * 100
}

/** Best sellers of the last 30 days (precomputed server-side for the storefront). */
export function bestSellerIds(d: TenantData, n = 8) {
  if (d.insights) return d.insights.bestSellers.slice(0, n)
  return [...productSales(ordersInRange(d, 'all', 29)).entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, n).map(([id]) => id)
}

/** Units sold per product over the last 90 days. */
export function soldQty(d: TenantData): Map<string, number> {
  if (d.insights) return new Map(Object.entries(d.insights.sold))
  return new Map([...productSales(ordersInRange(d, 'all', 89)).entries()].map(([id, v]) => [id, v.qty]))
}
