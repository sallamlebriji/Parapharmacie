import { Router, type NextFunction, type Request, type Response } from 'express'
import type { Prisma } from '@prisma/client'
import rateLimit from 'express-rate-limit'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { PLANS, REWARDS } from '../../../src/data/plans.js'
import { isLive } from '../../../src/lib/logic.js'
import type { Tenant } from '../../../src/lib/types.js'
import { checkPassword, hashPassword, readCustomer, sign } from '../auth.js'
import { config } from '../config.js'
import { prisma, tenantDb, type TenantDb } from '../db.js'
import { ah, badRequest, conflict, forbidden, notFound, unauthorized } from '../errors.js'
import * as M from '../mappers.js'
import { newId, notify, withRetry } from '../domain/common.js'
import { placeWebOrder } from '../domain/sales.js'
import { publicSnapshot } from '../snapshot.js'

/**
 * Public storefront API, one per tenant: /api/v1/store/:slug/…
 * Nothing here exposes purchase prices, stock lots, other customers or coupon codes.
 */
export const storeRouter = Router({ mergeParams: true })

interface StoreCtx { tenant: Tenant; db: TenantDb; customerId: string | null }
declare module 'express-serve-static-core' { interface Request { shop?: StoreCtx } }
const C = (req: Request) => req.shop!

storeRouter.use(async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const t = await prisma.tenant.findUnique({ where: { slug: req.params.slug } })
    if (!t || t.status === 'suspendu') throw notFound('Boutique introuvable')
    if (!PLANS.find((p) => p.id === t.plan)?.limits.ecommerce) throw forbidden('La boutique en ligne n’est pas activée pour cette parapharmacie')
    req.shop = { tenant: M.toTenant(t), db: tenantDb(t.id), customerId: readCustomer(req, t.id) }
    next()
  } catch (e) { next(e) }
})

const limiter = rateLimit({ windowMs: 10 * 60_000, limit: 40, standardHeaders: true, legacyHeaders: false, message: { error: 'Trop de requêtes, réessayez plus tard.' } })
const requireCustomer = (req: Request) => { if (!C(req).customerId) throw unauthorized('Connectez-vous à votre compte client'); return C(req).customerId! }
const publicTenant = (t: Tenant) => ({ ...t, settings: { currency: t.settings.currency, pointsPerDh: t.settings.pointsPerDh, pointValue: t.settings.pointValue, vatRate: t.settings.vatRate, lowStockDefault: 0 } })

storeRouter.get('/bootstrap', ah(async (req, res) => {
  const { db, tenant, customerId } = C(req)
  const wishlists = customerId ? (await db.wishlist.findMany({ where: { customerId } })).map(M.toWishlist) : null
  res.json({ tenant: publicTenant(tenant), data: await publicSnapshot(db, customerId), customerId, wishlists })
}))

/* ───────────── Comptes clients ───────────── */

storeRouter.post('/auth/register', limiter, ah(async (req, res) => {
  const b = z.object({ firstName: z.string().trim().min(1), lastName: z.string().trim().min(1), email: z.string().email(), phone: z.string().trim().min(6), password: z.string().min(8, 'Mot de passe : 8 caractères minimum'), marketingOptIn: z.boolean().default(false) }).parse(req.body)
  const { db } = C(req)
  const email = b.email.toLowerCase()
  const existing = await db.customer.findFirst({ where: { email } })
  if (existing?.passwordHash) throw conflict('Un compte existe déjà avec cet email')
  const passwordHash = await hashPassword(b.password)
  // A customer who already bought in store or as a guest keeps their history and points.
  const row = existing
    ? await db.customer.update({ where: { id: existing.id }, data: { passwordHash, marketingOptIn: b.marketingOptIn } })
    : await db.customer.create({ data: { id: newId('c'), firstName: b.firstName, lastName: b.lastName, email, phone: b.phone, address: '', city: '', createdAt: new Date(), points: 0, couponsUsed: [], favorites: [], marketingOptIn: b.marketingOptIn, passwordHash } as unknown as Prisma.CustomerUncheckedCreateInput })
  if (!existing) await notify(db, { type: 'client', title: 'Nouveau client', body: `${row.firstName} ${row.lastName} a créé son compte.`, link: '/admin/clients' })
  res.status(201).json({ token: sign({ kind: 'customer', sub: row.id, tid: C(req).tenant.id }), customerId: row.id })
}))

storeRouter.post('/auth/login', limiter, ah(async (req, res) => {
  const b = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body)
  const row = await C(req).db.customer.findFirst({ where: { email: b.email.toLowerCase(), passwordHash: { not: null } } })
  if (!row || !(await checkPassword(b.password, row.passwordHash!))) throw unauthorized('Email ou mot de passe incorrect')
  res.json({ token: sign({ kind: 'customer', sub: row.id, tid: C(req).tenant.id }), customerId: row.id })
}))

/** Development helper for the demo login screen. Disabled in production. */
storeRouter.get('/demo-accounts', ah(async (req, res) => {
  if (config.isProd) throw notFound()
  const rows = await C(req).db.customer.findMany({ where: { passwordHash: { not: null }, points: { gt: 200 } }, orderBy: { points: 'desc' }, take: 3, select: { email: true, firstName: true, lastName: true } })
  res.json(rows)
}))

/* ───────────── Panier & commande ───────────── */

storeRouter.get('/coupons/:code', limiter, ah(async (req, res) => {
  const row = await C(req).db.promotion.findFirst({ where: { code: req.params.code.trim().toUpperCase() } })
  const p = row && M.toPromotion(row)
  if (!p || !isLive(p)) throw notFound('Code promo invalide ou expiré')
  res.json(p)
}))

const lineSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('product'), productId: z.string(), qty: z.number().int().positive().max(50) }),
  z.object({ kind: z.literal('pack'), packId: z.string(), qty: z.number().int().positive().max(20) }),
])
const checkoutSchema = z.object({
  lines: z.array(lineSchema).min(1).max(60),
  customer: z.object({ firstName: z.string().trim().min(1), lastName: z.string().trim().min(1), email: z.string().email(), phone: z.string().trim().regex(/^0[5-7][\d\s]{8,}$/, 'Numéro de téléphone invalide'), address: z.string().trim().min(3), city: z.string().trim().min(2) }),
  coupon: z.string().trim().max(40).optional(),
  mode: z.enum(['standard', 'express', 'retrait']),
  method: z.enum(['carte', 'livraison']),
  usePoints: z.boolean().optional(),
})

storeRouter.post('/orders', limiter, ah(async (req, res) => {
  const input = checkoutSchema.parse(req.body)
  const { db, tenant, customerId } = C(req)
  if (input.usePoints && !customerId) throw unauthorized('Connectez-vous pour utiliser vos points')
  const r = await withRetry(() => db.$transaction((tx) => placeWebOrder(tx, tenant, input, customerId), { timeout: 20_000 }))
  // A guest becomes a customer session so they can follow their order.
  const token = sign({ kind: 'customer', sub: r.customer.id, tid: tenant.id })
  res.status(201).json({ order: r.order, customer: r.customer, token, guestKey: r.guestKey })
}))

storeRouter.get('/orders/:id', ah(async (req, res) => {
  const { db, customerId } = C(req)
  const o = await db.order.findFirst({ where: { id: req.params.id }, include: { items: true } })
  const allowed = o && ((customerId && o.customerId === customerId) || (typeof req.query.key === 'string' && o.guestKey === req.query.key))
  if (!o || !allowed) throw notFound('Commande introuvable')
  const c = o.customerId ? await db.customer.findFirst({ where: { id: o.customerId } }) : null
  res.json({ order: M.toOrder(o, false), customer: c && { firstName: c.firstName, lastName: c.lastName, email: c.email } })
}))

/* ───────────── Avis, favoris, fidélité ───────────── */

storeRouter.post('/reviews', limiter, ah(async (req, res) => {
  const b = z.object({ productId: z.string(), author: z.string().trim().min(2).max(120), rating: z.number().int().min(1).max(5), title: z.string().trim().min(2).max(160), text: z.string().trim().min(5).max(3000), hasPhoto: z.boolean().optional() }).parse(req.body)
  const { db, customerId } = C(req)
  const p = await db.product.findFirst({ where: { id: b.productId, active: true } })
  if (!p) throw notFound('Produit introuvable')
  const verified = !!customerId && !!(await db.order.findFirst({ where: { customerId, status: { not: 'annulee' }, items: { some: { productId: p.id } } } }))
  await db.review.create({ data: { id: newId('rv'), ...b, hasPhoto: !!b.hasPhoto, date: new Date(), verified, status: 'en_attente' } as unknown as Prisma.ReviewUncheckedCreateInput })
  await notify(db, { type: 'avis', title: 'Nouvel avis à modérer', body: `${b.author} — ${b.rating}/5 sur « ${p.name} »`, link: '/admin/ecommerce' })
  res.status(201).json({ ok: true })
}))

storeRouter.put('/me/wishlists', ah(async (req, res) => {
  const customerId = requireCustomer(req)
  const lists = z.array(z.object({ id: z.string(), name: z.string().trim().min(1).max(120), productIds: z.array(z.string()).max(200), alerts: z.object({ stock: z.boolean(), price: z.boolean() }) })).max(20).parse(req.body)
  const { db } = C(req)
  await db.$transaction(async (tx) => {
    await tx.wishlist.deleteMany({ where: { customerId } })
    if (lists.length) await tx.wishlist.createMany({ data: lists.map((w) => ({ ...w, id: newId('wl'), customerId })) as unknown as Prisma.WishlistCreateManyInput[] })
  })
  res.json((await db.wishlist.findMany({ where: { customerId } })).map(M.toWishlist))
}))

storeRouter.post('/me/redeem', ah(async (req, res) => {
  const customerId = requireCustomer(req)
  const { cost } = z.object({ cost: z.number().int() }).parse(req.body)
  const reward = REWARDS.find((r) => r.cost === cost)
  if (!reward) throw badRequest('Récompense inconnue')
  const { db, tenant } = C(req)
  const r = await db.$transaction(async (tx) => {
    const c = await tx.customer.findFirst({ where: { id: customerId } })
    if (!c || c.points < cost) throw conflict('Points insuffisants')
    const code = `FID${randomBytes(3).toString('hex').toUpperCase()}`
    const customer = await tx.customer.update({ where: { id: c.id }, data: { points: c.points - cost } })
    await tx.promotion.create({ data: { id: newId('pr'), name: `Bon fidélité — ${reward.label}`, code, type: 'fixe', value: Math.round(cost * tenant.settings.pointValue), startsAt: new Date(), endsAt: new Date(Date.now() + 60 * 864e5), active: true, uses: 0 } as unknown as Prisma.PromotionUncheckedCreateInput })
    return { code, customer: M.toCustomer(customer) }
  })
  res.status(201).json(r)
}))

/* ───────────── Chat client ↔ parapharmacie ───────────── */

storeRouter.post('/chats', limiter, ah(async (req, res) => {
  const b = z.object({ text: z.string().trim().min(1).max(2000), name: z.string().trim().max(160).default('Visiteur'), topic: z.enum(['produit', 'commande', 'assistance']).default('assistance'), history: z.array(z.object({ from: z.enum(['client', 'bot']), text: z.string().max(2000) })).max(20).default([]) }).parse(req.body)
  const { db, customerId } = C(req)
  const c = customerId ? await db.customer.findFirst({ where: { id: customerId } }) : null
  const now = new Date().toISOString()
  const guestKey = randomBytes(12).toString('hex')
  const row = await db.chatThread.create({
    data: { id: newId('ch'), customerId, customer: c ? `${c.firstName} ${c.lastName}` : b.name, subject: b.text.slice(0, 80), topic: b.topic, status: 'ouvert', guestKey, messages: [...b.history.map((m) => ({ ...m, date: now })), { from: 'client', text: b.text, date: now }] } as unknown as Prisma.ChatThreadUncheckedCreateInput,
  })
  res.status(201).json({ thread: M.toChat(row), key: guestKey })
}))

const threadFor = async (req: Request) => {
  const row = await C(req).db.chatThread.findFirst({ where: { id: req.params.id } })
  if (!row || !((C(req).customerId && row.customerId === C(req).customerId) || row.guestKey === req.query.key)) throw notFound('Conversation introuvable')
  return row
}
storeRouter.get('/chats/:id', ah(async (req, res) => { res.json(M.toChat(await threadFor(req))) }))
storeRouter.post('/chats/:id/messages', limiter, ah(async (req, res) => {
  const { text } = z.object({ text: z.string().trim().min(1).max(2000) }).parse(req.body)
  const t = await threadFor(req)
  const row = await C(req).db.chatThread.update({ where: { id: t.id }, data: { status: 'ouvert', messages: [...(t.messages as object[]), { from: 'client', text, date: new Date().toISOString() }] } })
  res.json(M.toChat(row))
}))
