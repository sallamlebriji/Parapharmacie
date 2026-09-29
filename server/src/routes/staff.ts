import { Router, type Request } from 'express'
import type { Prisma } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { PLANS } from '../../../src/data/plans.js'
import { customerStats, ordersInRange, productSales, stockIndex, validOrders, expiringLots, type Segment } from '../../../src/lib/logic.js'
import { toCSV } from '../../../src/lib/format.js'
import type { Permission, Role, TenantData } from '../../../src/lib/types.js'
import { hashPassword, requirePerm, requireStaff } from '../auth.js'
import { prisma, type TenantTx } from '../db.js'
import { ah, badRequest, conflict, forbidden, notFound } from '../errors.js'
import * as M from '../mappers.js'
import { dec, merge, newId, notify, withRetry, type Changes } from '../domain/common.js'
import * as Stock from '../domain/stock.js'
import * as Sales from '../domain/sales.js'
import * as Purchasing from '../domain/purchasing.js'
import { staffChanges, staffSnapshot } from '../snapshot.js'

export const staffRouter = Router()
staffRouter.use(requireStaff)

const S = (req: Request) => req.staff!
const tx = <X>(req: Request, fn: (tx: TenantTx) => Promise<X>) => withRetry(() => S(req).db.$transaction(fn, { timeout: 20_000 }))
const plan = (req: Request) => PLANS.find((p) => p.id === S(req).tenant.plan) ?? PLANS[0]
const audit = (req: Request, action: string, entity: string, entityId: string) =>
  S(req).db.auditLog.create({ data: { userId: S(req).userId, action, entity, entityId } as unknown as Prisma.AuditLogUncheckedCreateInput })

const permissionsOf = async (tenantId: string) => (await prisma.tenant.findUnique({ where: { id: tenantId } }))!.permissions as Record<Role, Permission[]>

/* ───────────── Snapshot & synchronisation ───────────── */

staffRouter.get('/bootstrap', ah(async (req, res) => {
  const s = S(req)
  const data = await staffSnapshot(s.db, s.perms, await permissionsOf(s.tenant.id))
  res.json({ serverTime: new Date().toISOString(), tenant: s.tenant, user: { id: s.userId, name: s.userName, role: s.role, storeId: s.storeId }, data })
}))

staffRouter.get('/sync', ah(async (req, res) => {
  const since = new Date(String(req.query.since ?? ''))
  if (Number.isNaN(since.getTime())) throw badRequest('Paramètre since invalide')
  const serverTime = new Date().toISOString()
  res.json({ serverTime, changes: await staffChanges(S(req).db, S(req).perms, new Date(since.getTime() - 2000)) })
}))

/* ───────────── Catalogue ───────────── */

const productSchema = z.object({
  name: z.string().trim().min(2).max(200), brand: z.string().min(1).max(80), ref: z.string().trim().max(40).optional().default(''), barcode: z.string().max(40).default(''),
  category: z.string().min(1), subcategory: z.string().min(1), needs: z.array(z.string()).default([]), skinTypes: z.array(z.string()).default([]),
  description: z.string().default(''), composition: z.string().default(''), usage: z.string().default(''), warnings: z.string().default(''),
  purchasePrice: z.number().min(0), price: z.number().positive('Prix de vente requis'), promoPrice: z.number().positive().nullish(), alertThreshold: z.number().int().min(0),
  supplierId: z.string().min(1), shape: z.string(), color: z.string().regex(/^#[0-9a-f]{6}$/i), volume: z.string().default(''), isNew: z.boolean().optional(), active: z.boolean().default(true),
})

staffRouter.post('/products', requirePerm('produits.edit'), ah(async (req, res) => {
  const p = productSchema.parse(req.body)
  if ((await S(req).db.product.count()) >= plan(req).limits.products) throw forbidden(`Limite de ${plan(req).limits.products} produits atteinte pour votre plan`)
  if (!S(req).can('prix_achat.edit')) p.purchasePrice = 0
  const row = await S(req).db.product.create({ data: { ...p, id: newId('p'), ref: p.ref || `REF-${randomBytes(3).toString('hex').toUpperCase()}`, promoPrice: p.promoPrice ?? null, purchasePrice: dec(p.purchasePrice), price: dec(p.price), isNew: p.isNew ?? true } as unknown as Prisma.ProductUncheckedCreateInput })
  await audit(req, 'create', 'product', row.id)
  res.status(201).json({ changes: { products: [M.toProduct(row, S(req).can('prix_achat.view'))] }, result: { id: row.id } })
}))

staffRouter.put('/products/:id', requirePerm('produits.edit'), ah(async (req, res) => {
  const p = productSchema.parse(req.body)
  const prev = await S(req).db.product.findFirst({ where: { id: req.params.id } })
  if (!prev) throw notFound('Produit introuvable')
  // Purchase price can only be changed with the dedicated permission.
  const purchasePrice = S(req).can('prix_achat.edit') ? dec(p.purchasePrice) : prev.purchasePrice
  const row = await S(req).db.product.update({ where: { id: prev.id }, data: { ...p, ref: p.ref || prev.ref, purchasePrice, price: dec(p.price), promoPrice: p.promoPrice ? dec(p.promoPrice) : null } })
  const notifications = []
  const oldPrice = Math.min(Number(prev.price), Number(prev.promoPrice ?? Infinity))
  const newPrice = Math.min(Number(row.price), Number(row.promoPrice ?? Infinity))
  if (newPrice < oldPrice) notifications.push(await notify(S(req).db, { type: 'retour_stock', title: 'Alerte baisse de prix envoyée', body: `Les clients ayant « ${row.name} » en favoris ont été notifiés.`, link: '/admin/marketing' }))
  await audit(req, 'update', 'product', row.id)
  res.json({ changes: { products: [M.toProduct(row, S(req).can('prix_achat.view'))], notifications } })
}))

/* ───────────── Stock ───────────── */

const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Date invalide')

staffRouter.post('/stock/lots', requirePerm('stock.manage'), ah(async (req, res) => {
  const b = z.object({ productId: z.string(), storeId: z.string(), number: z.string().trim().min(1), qty: z.number().int().positive(), expiresAt: iso, note: z.string().optional() }).parse(req.body)
  res.status(201).json({ changes: await tx(req, (t) => Stock.addLot(t, { ...b, user: S(req).userName })) })
}))

staffRouter.post('/stock/adjust', requirePerm('stock.manage'), ah(async (req, res) => {
  const b = z.object({ productId: z.string(), storeId: z.string(), delta: z.number().int().refine((x) => x !== 0), note: z.string().min(1), type: z.enum(['ajustement', 'sortie']).default('ajustement') }).parse(req.body)
  res.json({ changes: await tx(req, (t) => Stock.adjust(t, S(req).tenant.id, { ...b, user: S(req).userName })) })
}))

staffRouter.post('/stock/inventory', requirePerm('stock.manage'), ah(async (req, res) => {
  const b = z.object({ productId: z.string(), storeId: z.string(), counted: z.number().int().min(0) }).parse(req.body)
  res.json({ changes: await tx(req, (t) => Stock.inventory(t, S(req).tenant.id, { ...b, user: S(req).userName })) })
}))

staffRouter.post('/stock/transfer', requirePerm('stock.manage'), ah(async (req, res) => {
  const b = z.object({ productId: z.string(), from: z.string(), to: z.string(), qty: z.number().int().positive() }).parse(req.body)
  res.json({ changes: await tx(req, (t) => Stock.transfer(t, S(req).tenant.id, { ...b, user: S(req).userName })) })
}))

staffRouter.post('/stock/import', requirePerm('stock.manage'), ah(async (req, res) => {
  const rows = z.array(z.object({ ref: z.string(), store: z.string().default(''), qty: z.number().int().min(0), lot: z.string().optional(), expiry: z.string().optional() })).max(5000).parse(req.body.rows)
  const s = S(req)
  const [products, stores] = await Promise.all([s.db.product.findMany({ select: { id: true, ref: true, barcode: true } }), s.db.store.findMany()])
  let changes: Changes = {}
  const errors: string[] = []
  await tx(req, async (t) => {
    for (const [i, r] of rows.entries()) {
      const p = products.find((x) => x.ref === r.ref || x.barcode === r.ref)
      const st = stores.find((x) => x.name === r.store || x.city === r.store || x.id === r.store) ?? stores[0]
      if (!p) { errors.push(`Ligne ${i + 2} : référence inconnue « ${r.ref} »`); continue }
      if (r.lot) changes = merge(changes, await Stock.addLot(t, { productId: p.id, storeId: st.id, number: r.lot, qty: r.qty, expiresAt: r.expiry && !Number.isNaN(Date.parse(r.expiry)) ? r.expiry : new Date(Date.now() + 365 * 864e5).toISOString(), note: 'Import CSV', user: s.userName }))
      else changes = merge(changes, await Stock.inventory(t, s.tenant.id, { productId: p.id, storeId: st.id, counted: r.qty, user: s.userName }))
    }
  })
  res.json({ changes, result: { applied: rows.length - errors.length, errors } })
}))

staffRouter.get('/stock/export', requirePerm('stock.manage'), ah(async (req, res) => {
  const s = S(req)
  const [lots, products, stores] = await Promise.all([s.db.lot.findMany({ orderBy: { expiresAt: 'asc' } }), s.db.product.findMany(), s.db.store.findMany()])
  const csv = toCSV(lots.map((l) => ({ reference: products.find((p) => p.id === l.productId)?.ref ?? '', produit: products.find((p) => p.id === l.productId)?.name ?? '', boutique: stores.find((x) => x.id === l.storeId)?.city ?? '', lot: l.number, quantite: l.qty, expiration: l.expiresAt.toISOString().slice(0, 10) })))
  res.setHeader('Content-Type', 'text/csv; charset=utf-8').setHeader('Content-Disposition', 'attachment; filename="stock.csv"').send('﻿' + csv)
}))

/* ───────────── Commandes & POS ───────────── */

staffRouter.post('/orders/:id/advance', requirePerm('commandes.manage'), ah(async (req, res) => {
  const to = z.object({ to: z.enum(['preparation', 'expediee', 'livraison', 'livree']).optional() }).parse(req.body ?? {}).to
  res.json({ changes: await tx(req, (t) => Sales.advanceOrder(t, S(req).tenant.id, req.params.id, S(req).userName, to)) })
}))
staffRouter.post('/orders/:id/cancel', requirePerm('commandes.manage'), ah(async (req, res) => { res.json({ changes: await tx(req, (t) => Sales.cancelOrder(t, S(req).tenant, req.params.id)) }) }))
staffRouter.post('/orders/:id/mark-paid', requirePerm('commandes.manage'), ah(async (req, res) => { res.json({ changes: await tx(req, (t) => Sales.markPaid(t, req.params.id)) }) }))

staffRouter.post('/pos/sales', requirePerm('pos.use'), ah(async (req, res) => {
  const b = z.object({ storeId: z.string(), lines: z.array(z.object({ productId: z.string(), qty: z.number().int().positive() })).min(1), discount: z.number().min(0).default(0), method: z.enum(['carte', 'especes']), customerId: z.string().optional(), pointsUsed: z.number().int().min(0).optional() }).parse(req.body)
  const s = S(req)
  // Sellers can only ring up sales in their own store.
  if (s.role === 'vendeur' && s.storeId && s.storeId !== b.storeId) throw forbidden('Vous ne pouvez encaisser que dans votre boutique')
  const r = await tx(req, (t) => Sales.posSale(t, s.tenant, { name: s.userName, canDiscount: s.can('pos.remise') }, b))
  const { order, ...changes } = r
  res.status(201).json({ changes, result: order })
}))

staffRouter.post('/pos/returns', requirePerm('pos.use'), ah(async (req, res) => {
  const b = z.object({ orderId: z.string(), items: z.array(z.object({ productId: z.string(), qty: z.number().int().min(0) })), mode: z.enum(['remboursement', 'avoir']) }).parse(req.body)
  res.status(201).json({ changes: await tx(req, (t) => Sales.posReturn(t, S(req).tenant, S(req).userName, b.orderId, b.items, b.mode)) })
}))

/* ───────────── Achats & fournisseurs ───────────── */

const poSchema = z.object({ supplierId: z.string(), storeId: z.string(), expectedAt: iso, lines: z.array(z.object({ productId: z.string(), qty: z.number().int().min(0), unitCost: z.number().min(0) })), status: z.enum(['brouillon', 'envoyee']) })
staffRouter.post('/purchase-orders', requirePerm('achats.manage'), ah(async (req, res) => { res.status(201).json({ changes: await tx(req, (t) => Purchasing.savePurchaseOrder(t, poSchema.parse(req.body))) }) }))
staffRouter.put('/purchase-orders/:id', requirePerm('achats.manage'), ah(async (req, res) => { res.json({ changes: await tx(req, (t) => Purchasing.savePurchaseOrder(t, { ...poSchema.parse(req.body), id: req.params.id })) }) }))
staffRouter.post('/purchase-orders/:id/send', requirePerm('achats.manage'), ah(async (req, res) => { res.json({ changes: await tx(req, (t) => Purchasing.sendPurchaseOrder(t, req.params.id)) }) }))
staffRouter.post('/purchase-orders/:id/receive', requirePerm('achats.manage', 'stock.manage'), ah(async (req, res) => {
  const receipts = z.array(z.object({ index: z.number().int().min(0), qty: z.number().int().min(0), lotNumber: z.string(), expiresAt: iso })).parse(req.body.receipts)
  res.json({ changes: await tx(req, (t) => Purchasing.receivePurchaseOrder(t, req.params.id, receipts, S(req).userName)) })
}))
staffRouter.post('/purchase-orders/:id/pay', requirePerm('achats.manage', 'finance.view'), ah(async (req, res) => { res.json({ changes: await tx(req, (t) => Purchasing.payInvoice(t, req.params.id)) }) }))

const supplierSchema = z.object({ name: z.string().trim().min(2), contact: z.string().default(''), email: z.string().default(''), phone: z.string().default(''), city: z.string().default(''), paymentTerms: z.string().default('30 jours'), brands: z.array(z.string()).default([]) })
staffRouter.post('/suppliers', requirePerm('achats.manage'), ah(async (req, res) => {
  const row = await S(req).db.supplier.create({ data: { id: newId('sup'), ...supplierSchema.parse(req.body) } as unknown as Prisma.SupplierUncheckedCreateInput })
  res.status(201).json({ changes: { suppliers: [M.toSupplier(row)] } })
}))
staffRouter.put('/suppliers/:id', requirePerm('achats.manage'), ah(async (req, res) => {
  res.json({ changes: { suppliers: [M.toSupplier(await S(req).db.supplier.update({ where: { id: req.params.id }, data: supplierSchema.parse(req.body) }))] } })
}))

/* ───────────── Clients & fidélité ───────────── */

const customerSchema = z.object({ firstName: z.string().trim().min(1), lastName: z.string().trim().min(1), phone: z.string().trim().min(6), email: z.string().email().or(z.literal('')), address: z.string().default(''), city: z.string().default(''), skinType: z.string().optional(), marketingOptIn: z.boolean().default(false) })
staffRouter.post('/customers', requirePerm('clients.manage', 'pos.use'), ah(async (req, res) => {
  const c = customerSchema.parse(req.body)
  const row = await S(req).db.customer.create({ data: { ...c, email: c.email.toLowerCase(), id: newId('c'), createdAt: new Date(), points: 0, couponsUsed: [], favorites: [] } as unknown as Prisma.CustomerUncheckedCreateInput })
  res.status(201).json({ changes: { customers: [M.toCustomer(row)] }, result: { id: row.id } })
}))
staffRouter.put('/customers/:id', requirePerm('clients.manage'), ah(async (req, res) => {
  res.json({ changes: { customers: [M.toCustomer(await S(req).db.customer.update({ where: { id: req.params.id }, data: customerSchema.parse(req.body) }))] } })
}))
staffRouter.post('/customers/:id/points', requirePerm('clients.manage'), ah(async (req, res) => {
  const { delta } = z.object({ delta: z.number().int() }).parse(req.body)
  const row = await tx(req, async (t) => {
    const c = await t.customer.findFirst({ where: { id: req.params.id } })
    if (!c) throw notFound('Client introuvable')
    return t.customer.update({ where: { id: c.id }, data: { points: Math.max(0, c.points + delta) } })
  })
  await audit(req, `points ${delta > 0 ? '+' : ''}${delta}`, 'customer', row.id)
  res.json({ changes: { customers: [M.toCustomer(row)] } })
}))

/* ───────────── Promotions, packs, avis ───────────── */

const promoSchema = z.object({
  name: z.string().trim().min(2), code: z.string().trim().toUpperCase().max(40).optional(), type: z.enum(['pourcentage', 'fixe', 'categorie', 'marque', 'bxgy', 'flash', 'saisonniere']),
  value: z.number().min(0), target: z.string().optional(), buyX: z.number().int().positive().optional(), getY: z.number().int().positive().optional(), minAmount: z.number().min(0).optional(),
  startsAt: iso, endsAt: iso, active: z.boolean(), highlight: z.boolean().optional(),
}).refine((p) => Date.parse(p.endsAt) > Date.parse(p.startsAt), 'La fin doit être après le début')
  .refine((p) => !['pourcentage', 'categorie', 'marque', 'flash', 'saisonniere'].includes(p.type) || p.value <= 90, 'Réduction maximale : 90 %')
const promoData = (p: z.infer<typeof promoSchema>) => ({ ...p, code: p.code || null, target: p.target ?? null, buyX: p.buyX ?? null, getY: p.getY ?? null, value: dec(p.value), minAmount: p.minAmount ? dec(p.minAmount) : null, highlight: !!p.highlight, startsAt: new Date(p.startsAt), endsAt: new Date(p.endsAt) })
staffRouter.post('/promotions', requirePerm('promotions.manage'), ah(async (req, res) => {
  const row = await S(req).db.promotion.create({ data: { id: newId('pr'), ...promoData(promoSchema.parse(req.body)), uses: 0 } as unknown as Prisma.PromotionUncheckedCreateInput })
  res.status(201).json({ changes: { promotions: [M.toPromotion(row)] } })
}))
staffRouter.put('/promotions/:id', requirePerm('promotions.manage'), ah(async (req, res) => {
  res.json({ changes: { promotions: [M.toPromotion(await S(req).db.promotion.update({ where: { id: req.params.id }, data: promoData(promoSchema.parse(req.body)) }))] } })
}))

const packSchema = z.object({ slug: z.string().default(''), name: z.string().trim().min(2), kind: z.enum(['visage', 'cheveux', 'imperfections', 'homme', 'bebe', 'solaire']), tagline: z.string().default(''), description: z.string().default(''), productIds: z.array(z.string()).min(2), price: z.number().positive(), steps: z.array(z.string()) })
staffRouter.post('/packs', requirePerm('promotions.manage'), ah(async (req, res) => {
  const p = packSchema.parse(req.body)
  const row = await S(req).db.pack.create({ data: { ...p, id: newId('pk'), slug: p.slug || p.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-'), price: dec(p.price) } as unknown as Prisma.PackUncheckedCreateInput })
  res.status(201).json({ changes: { packs: [M.toPack(row)] } })
}))
staffRouter.put('/packs/:id', requirePerm('promotions.manage'), ah(async (req, res) => {
  const p = packSchema.parse(req.body)
  res.json({ changes: { packs: [M.toPack(await S(req).db.pack.update({ where: { id: req.params.id }, data: { ...p, price: dec(p.price) } }))] } })
}))

staffRouter.post('/reviews/:id/moderate', requirePerm('promotions.manage'), ah(async (req, res) => {
  const { publish } = z.object({ publish: z.boolean() }).parse(req.body)
  const changes = await tx(req, async (t): Promise<Changes & { removed?: Record<string, string[]> }> => {
    const r = await t.review.findFirst({ where: { id: req.params.id } })
    if (!r) throw notFound('Avis introuvable')
    if (publish) await t.review.update({ where: { id: r.id }, data: { status: 'publie' } })
    else await t.review.delete({ where: { id: r.id } })
    const agg = await t.review.aggregate({ where: { productId: r.productId, status: 'publie' }, _avg: { rating: true }, _count: true })
    const p = await t.product.update({ where: { id: r.productId }, data: { rating: Math.round((agg._avg.rating ?? 0) * 10) / 10, reviewsCount: agg._count } })
    const reviews = publish ? [M.toReview((await t.review.findFirst({ where: { id: r.id } }))!)] : []
    return { reviews, products: [M.toProduct(p, S(req).can('prix_achat.view'))], removed: publish ? undefined : { reviews: [r.id] } }
  })
  const { removed, ...rest } = changes
  res.json({ changes: rest, removed })
}))

/* ───────────── Livraisons, marketing, finance ───────────── */

const zoneSchema = z.object({ name: z.string().trim().min(2), cities: z.array(z.string()).min(1), standardFee: z.number().min(0), expressFee: z.number().min(0), freeAbove: z.number().min(0), standardDelay: z.string(), expressDelay: z.string(), active: z.boolean() })
const zoneData = (z: z.infer<typeof zoneSchema>) => ({ ...z, standardFee: dec(z.standardFee), expressFee: dec(z.expressFee), freeAbove: dec(z.freeAbove) })
staffRouter.post('/zones', requirePerm('commandes.manage'), ah(async (req, res) => {
  res.status(201).json({ changes: { zones: [M.toZone(await S(req).db.deliveryZone.create({ data: { id: newId('z'), ...zoneData(zoneSchema.parse(req.body)) } as unknown as Prisma.DeliveryZoneUncheckedCreateInput }))] } })
}))
staffRouter.put('/zones/:id', requirePerm('commandes.manage'), ah(async (req, res) => {
  res.json({ changes: { zones: [M.toZone(await S(req).db.deliveryZone.update({ where: { id: req.params.id }, data: zoneData(zoneSchema.parse(req.body)) }))] } })
}))

const campaignSchema = z.object({ name: z.string().trim().min(2), channel: z.enum(['email', 'sms', 'push']), segment: z.string(), subject: z.string().default(''), date: iso, status: z.enum(['brouillon', 'programmee']) })
const SEGMENT_OF: Record<string, Segment | undefined> = { 'Nouveaux clients': 'nouveau', 'Clients réguliers': 'regulier', 'Clients VIP': 'vip', 'Clients inactifs': 'inactif', 'Clients occasionnels': 'occasionnel' }

staffRouter.post('/campaigns', requirePerm('marketing.manage'), ah(async (req, res) => {
  if (!plan(req).limits.marketing) throw forbidden('Le module marketing est inclus à partir du plan Pro')
  const c = campaignSchema.parse(req.body)
  res.status(201).json({ changes: { campaigns: [M.toCampaign(await S(req).db.campaign.create({ data: { id: newId('cp'), ...c, date: new Date(c.date) } as unknown as Prisma.CampaignUncheckedCreateInput }))] } })
}))
staffRouter.put('/campaigns/:id', requirePerm('marketing.manage'), ah(async (req, res) => {
  const c = campaignSchema.parse(req.body)
  res.json({ changes: { campaigns: [M.toCampaign(await S(req).db.campaign.update({ where: { id: req.params.id }, data: { ...c, date: new Date(c.date) } }))] } })
}))
/** Sends to opted-in customers of the segment. Audience is computed server-side; delivery goes through the messaging worker. */
staffRouter.post('/campaigns/:id/send', requirePerm('marketing.manage'), ah(async (req, res) => {
  if (!plan(req).limits.marketing) throw forbidden('Le module marketing est inclus à partir du plan Pro')
  const s = S(req)
  const camp = await s.db.campaign.findFirst({ where: { id: req.params.id } })
  if (!camp) throw notFound('Campagne introuvable')
  if (camp.status === 'envoyee') throw conflict('Campagne déjà envoyée')
  const [customers, orders] = await Promise.all([s.db.customer.findMany({ where: { marketingOptIn: true } }), s.db.order.findMany({ where: { customerId: { not: null } }, include: { items: true } })])
  const d = { orders: orders.map((o) => M.toOrder(o)) } as TenantData
  const seg = SEGMENT_OF[camp.segment]
  const audience = customers.filter((c) => !seg || customerStats(d, M.toCustomer(c)).segment === seg).length
  const row = await s.db.campaign.update({ where: { id: camp.id }, data: { status: 'envoyee', sent: audience, date: new Date() } })
  await audit(req, `send to ${audience}`, 'campaign', camp.id)
  res.json({ changes: { campaigns: [M.toCampaign(row)] }, result: { audience } })
}))

staffRouter.post('/expenses', requirePerm('finance.view'), ah(async (req, res) => {
  const e = z.object({ label: z.string().trim().min(1), category: z.string(), amount: z.number().positive(), storeId: z.string() }).parse(req.body)
  res.status(201).json({ changes: { expenses: [M.toExpense(await S(req).db.expense.create({ data: { id: newId('x'), ...e, amount: dec(e.amount), date: new Date() } as unknown as Prisma.ExpenseUncheckedCreateInput }))] } })
}))

/* ───────────── Organisation ───────────── */

const ROLES = ['admin', 'manager', 'vendeur', 'stock', 'preparateur'] as const
const employeeSchema = z.object({ name: z.string().trim().min(2), email: z.string().email(), role: z.enum(ROLES), storeId: z.string(), active: z.boolean() })

/** Invites an employee: the account is created with a one-time temporary password shown to the admin. */
staffRouter.post('/employees', requirePerm('employes.manage'), ah(async (req, res) => {
  const e = employeeSchema.parse(req.body)
  const s = S(req)
  if ((await s.db.user.count({ where: { active: true } })) >= plan(req).limits.users) throw forbidden(`Limite de ${plan(req).limits.users} utilisateurs atteinte pour votre plan`)
  if (await prisma.user.findUnique({ where: { email: e.email.toLowerCase() } })) throw conflict('Cet email est déjà utilisé')
  const temporaryPassword = randomBytes(6).toString('base64url')
  const row = await s.db.user.create({ data: { id: newId('e'), ...e, email: e.email.toLowerCase(), passwordHash: await hashPassword(temporaryPassword) } as unknown as Prisma.UserUncheckedCreateInput })
  await audit(req, 'invite', 'user', row.id)
  res.status(201).json({ changes: { employees: [M.toEmployee(row)] }, result: { temporaryPassword } })
}))
staffRouter.put('/employees/:id', requirePerm('employes.manage'), ah(async (req, res) => {
  const e = employeeSchema.parse(req.body)
  if (req.params.id === S(req).userId && (!e.active || e.role !== 'admin')) throw conflict('Vous ne pouvez pas désactiver ou rétrograder votre propre compte')
  const row = await S(req).db.user.update({ where: { id: req.params.id }, data: { name: e.name, role: e.role, storeId: e.storeId, active: e.active } })
  await audit(req, 'update', 'user', row.id)
  res.json({ changes: { employees: [M.toEmployee(row)] } })
}))

staffRouter.put('/permissions', requirePerm('employes.manage'), ah(async (req, res) => {
  const b = z.object({ role: z.enum(ROLES), permission: z.string(), enabled: z.boolean() }).parse(req.body)
  if (b.role === 'admin') throw conflict('Les permissions administrateur ne sont pas modifiables')
  const perms = await permissionsOf(S(req).tenant.id)
  const cur = new Set(perms[b.role])
  if (b.enabled) cur.add(b.permission as Permission); else cur.delete(b.permission as Permission)
  const next = { ...perms, [b.role]: [...cur] }
  await prisma.tenant.update({ where: { id: S(req).tenant.id }, data: { permissions: next } })
  res.json({ changes: {}, result: { permissions: next } })
}))

const storeSchema = z.object({ name: z.string().trim().min(2), city: z.string().trim().min(2), address: z.string().default(''), phone: z.string().default(''), manager: z.string().default(''), openedAt: z.string().default(new Date().toISOString().slice(0, 10)) })
staffRouter.post('/stores', requirePerm('parametres.manage'), ah(async (req, res) => {
  if ((await S(req).db.store.count()) >= plan(req).limits.stores) throw forbidden(`Votre plan inclut ${plan(req).limits.stores} boutique(s) — passez au plan supérieur`)
  res.status(201).json({ changes: { stores: [M.toStore(await S(req).db.store.create({ data: { id: newId('st'), ...storeSchema.parse(req.body) } as unknown as Prisma.StoreUncheckedCreateInput }))] } })
}))
staffRouter.put('/stores/:id', requirePerm('parametres.manage'), ah(async (req, res) => {
  res.json({ changes: { stores: [M.toStore(await S(req).db.store.update({ where: { id: req.params.id }, data: storeSchema.parse(req.body) }))] } })
}))

staffRouter.put('/tenant', requirePerm('parametres.manage'), ah(async (req, res) => {
  const b = z.object({
    name: z.string().trim().min(2).max(160).optional(), tagline: z.string().max(255).optional(), primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    settings: z.object({ pointsPerDh: z.number().min(0).max(1), pointValue: z.number().min(0).max(10), vatRate: z.number().min(0).max(30), lowStockDefault: z.number().int().min(0) }).partial().optional(),
  }).parse(req.body)
  const t = S(req).tenant
  const row = await prisma.tenant.update({ where: { id: t.id }, data: { name: b.name, tagline: b.tagline, primaryColor: b.primaryColor, settings: { ...t.settings, ...(b.settings ?? {}) } } })
  res.json({ tenant: M.toTenant(row) })
}))
staffRouter.put('/tenant/plan', requirePerm('parametres.manage'), ah(async (req, res) => {
  const { plan: id } = z.object({ plan: z.enum(['essentiel', 'pro', 'reseau']) }).parse(req.body)
  const target = PLANS.find((p) => p.id === id)!
  const s = S(req)
  const [stores, users, products] = await Promise.all([s.db.store.count(), s.db.user.count({ where: { active: true } }), s.db.product.count()])
  if (stores > target.limits.stores || users > target.limits.users || products > target.limits.products) throw conflict(`Votre usage actuel dépasse les limites du plan ${target.name}`)
  // Billing provider checkout would happen here; the demo activates the plan directly.
  res.json({ tenant: M.toTenant(await prisma.tenant.update({ where: { id: s.tenant.id }, data: { plan: id, status: 'actif' } })) })
}))

/* ───────────── Notifications & messages ───────────── */

staffRouter.post('/notifications/read-all', ah(async (req, res) => {
  await S(req).db.notification.updateMany({ where: { read: false }, data: { read: true } })
  res.json({ changes: { notifications: (await S(req).db.notification.findMany({ orderBy: { date: 'desc' }, take: 100 })).map(M.toNotification) } })
}))

staffRouter.post('/chats/:id/messages', requirePerm('clients.manage', 'commandes.manage'), ah(async (req, res) => {
  const { text } = z.object({ text: z.string().trim().min(1).max(2000) }).parse(req.body)
  const c = await S(req).db.chatThread.findFirst({ where: { id: req.params.id } })
  if (!c) throw notFound('Conversation introuvable')
  const row = await S(req).db.chatThread.update({ where: { id: c.id }, data: { messages: [...(c.messages as object[]), { from: 'staff', text, date: new Date().toISOString() }] } })
  res.json({ changes: { chats: [M.toChat(row)] } })
}))
staffRouter.post('/chats/:id/resolve', requirePerm('clients.manage', 'commandes.manage'), ah(async (req, res) => {
  res.json({ changes: { chats: [M.toChat(await S(req).db.chatThread.update({ where: { id: req.params.id }, data: { status: 'resolu' } }))] } })
}))

/* ───────────── Rapports (API pour les apps mobiles / intégrations) ───────────── */

staffRouter.get('/reports/dashboard', requirePerm('dashboard.view'), ah(async (req, res) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days ?? 30)))
  const scope = String(req.query.storeId ?? 'all')
  const s = S(req)
  const [orders, lots, products] = await Promise.all([
    s.db.order.findMany({ where: { createdAt: { gte: new Date(Date.now() - (days * 2 + 1) * 864e5) } }, include: { items: true } }),
    s.db.lot.findMany(), s.db.product.findMany({ where: { active: true } }),
  ])
  const d = { orders: orders.map((o) => M.toOrder(o)), lots: lots.map(M.toLot), products: products.map((p) => M.toProduct(p)), stores: await s.db.store.findMany().then((x) => x.map(M.toStore)) } as TenantData
  const cur = ordersInRange(d, scope, days - 1)
  const ca = cur.reduce((a, o) => a + o.total - o.shipping, 0)
  const idx = stockIndex(d, scope)
  const top = [...productSales(cur).entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 5).map(([id, v]) => ({ productId: id, name: d.products.find((p) => p.id === id)?.name, ...v }))
  res.json({
    periodDays: days, revenue: Math.round(ca), orders: cur.length, averageBasket: cur.length ? Math.round(ca / cur.length) : 0,
    lowStock: d.products.filter((p) => idx(p).state === 'faible').length, outOfStock: d.products.filter((p) => idx(p).state === 'rupture').length,
    expiring30: expiringLots(d, 30, scope).length, validOrders: validOrders(d, scope).length, topProducts: top,
  })
}))
