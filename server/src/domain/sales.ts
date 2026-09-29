import { Prisma } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { computeCart, priceOf, toOrderItems, type CartLine } from '../../../src/lib/logic.js'
import type { Order, OrderStatus, Tenant } from '../../../src/lib/types.js'
import type { TenantTx } from '../db.js'
import { badRequest, conflict, forbidden, notFound } from '../errors.js'
import * as M from '../mappers.js'
import { dec, newId, nextNumber, notify, pricingData, type Changes } from './common.js'
import { consume, lockLots, lowStockCheck } from './stock.js'

const FLOW: OrderStatus[] = ['recue', 'preparation', 'expediee', 'livraison', 'livree']

async function orderRow(tx: TenantTx, id: string) {
  const o = await tx.order.findFirst({ where: { id }, include: { items: true } })
  if (!o) throw notFound('Commande introuvable')
  return o
}

const itemsCreate = (items: Order['items']) => ({ create: items.map((i) => ({ productId: i.productId, qty: i.qty, unitPrice: dec(i.unitPrice), unitCost: dec(i.unitCost) })) })

/* ───────────────────────── E-commerce checkout ───────────────────────── */

export interface CheckoutInput {
  lines: CartLine[]
  customer: { firstName: string; lastName: string; email: string; phone: string; address: string; city: string }
  coupon?: string
  mode: 'standard' | 'express' | 'retrait'
  method: 'carte' | 'livraison'
  usePoints?: boolean
}

/**
 * Places a web order. Everything monetary is recomputed server-side with the shared cart rules —
 * the client's displayed totals are never trusted. Stock of the web warehouse is locked, and the
 * requested quantities must fit in (physical − already reserved). Stock is only consumed at shipping.
 */
export async function placeWebOrder(tx: TenantTx, tenant: Tenant, input: CheckoutInput, customerId: string | null) {
  if (!input.lines.length) throw badRequest('Panier vide')
  const d = await pricingData(tx)
  for (const l of input.lines) {
    if (l.kind === 'product' && !d.products.find((p) => p.id === l.productId && p.active)) throw badRequest('Un produit du panier n’est plus disponible')
    if (l.kind === 'pack' && !d.packs.find((p) => p.id === l.packId)) throw badRequest('Un pack du panier n’est plus disponible')
  }

  // Customer: signed-in account, else match by email, else create.
  let customer = customerId ? await tx.customer.findFirst({ where: { id: customerId } }) : await tx.customer.findFirst({ where: { email: input.customer.email.toLowerCase() } })
  const isNew = !customer
  if (!customer) {
    customer = await tx.customer.create({ data: { id: newId('c'), ...input.customer, email: input.customer.email.toLowerCase(), createdAt: new Date(), points: 0, couponsUsed: [], favorites: [], marketingOptIn: true } as unknown as Prisma.CustomerUncheckedCreateInput })
  }
  const past = await tx.order.count({ where: { customerId: customer.id } })
  d.orders = past ? [{ customerId: customer.id } as Order] : []

  const zone = d.zones.find((z) => z.active && z.cities.includes(input.customer.city)) ?? d.zones.filter((z) => z.active).at(-1) ?? d.zones[0]
  if (!zone) throw conflict('Aucune zone de livraison configurée')
  const cart = computeCart(d, tenant, input.lines, { coupon: input.coupon, zoneId: zone.id, mode: input.mode, points: input.usePoints ? Infinity : 0, customer: M.toCustomer(customer) })
  if (input.coupon && cart.couponError) throw badRequest(cart.couponError)
  if (input.mode === 'retrait' && !d.stores.some((s) => s.city === input.customer.city)) throw badRequest('Pas de boutique pour le retrait dans cette ville')

  // Availability in the web warehouse, under lock.
  const warehouse = d.stores[0].id
  const items = toOrderItems(d, input.lines)
  const wanted = new Map<string, number>()
  items.forEach((i) => wanted.set(i.productId, (wanted.get(i.productId) ?? 0) + i.qty))
  const lots = await lockLots(tx, tenant.id, warehouse, [...wanted.keys()])
  const open = await tx.order.findMany({ where: { channel: 'web', storeId: warehouse, status: { in: ['recue', 'preparation'] } }, include: { items: true } })
  for (const [pid, qty] of wanted) {
    const physical = lots.filter((l) => l.productId === pid).reduce((s, l) => s + l.qty, 0)
    const reserved = open.reduce((s, o) => s + o.items.filter((i) => i.productId === pid).reduce((a, i) => a + i.qty, 0), 0)
    if (physical - reserved < qty) throw conflict(`Stock insuffisant pour « ${d.products.find((p) => p.id === pid)?.name} » (disponible : ${Math.max(0, physical - reserved)})`)
  }

  const now = new Date()
  const row = await tx.order.create({
    data: {
      id: newId('o'), number: await nextNumber(tx, 'WEB'), channel: 'web', storeId: warehouse, customerId: customer.id,
      subtotal: dec(cart.subtotal), discount: dec(cart.bxgy + cart.couponDiscount + cart.pointsDiscount), shipping: dec(cart.shipping), total: dec(cart.total),
      couponCode: cart.couponPromo && !cart.couponError ? cart.couponPromo.code : null, pointsUsed: cart.pointsUsed || null, status: 'recue',
      paymentMethod: input.method, paymentStatus: input.method === 'carte' ? 'paye' : 'en_attente',
      delivery: { mode: input.mode, zoneId: zone.id, address: input.customer.address, city: input.customer.city },
      history: [{ status: 'recue', date: now.toISOString() }], guestKey: randomBytes(12).toString('hex'), createdAt: now,
      items: itemsCreate(items),
    } as unknown as Prisma.OrderUncheckedCreateInput,
    include: { items: true },
  })
  const couponsUsed = (customer.couponsUsed as string[]) ?? []
  const updatedCustomer = await tx.customer.update({
    where: { id: customer.id },
    data: {
      address: input.customer.address, city: input.customer.city, phone: input.customer.phone,
      points: customer.points - cart.pointsUsed + cart.pointsEarned,
      couponsUsed: row.couponCode ? [...couponsUsed, row.couponCode] : couponsUsed,
    },
  })
  if (row.couponCode) await tx.promotion.updateMany({ where: { code: row.couponCode }, data: { uses: { increment: 1 } } })
  const notifications = [await notify(tx, { type: 'commande', title: 'Nouvelle commande en ligne', body: `${row.number} — ${cart.total.toFixed(0)} DH à préparer`, link: `/admin/commandes/${row.id}` })]
  if (row.paymentStatus === 'paye') notifications.push(await notify(tx, { type: 'paiement', title: 'Paiement confirmé', body: `${row.number} payée par carte.`, link: `/admin/commandes/${row.id}` }))
  if (isNew) notifications.push(await notify(tx, { type: 'client', title: 'Nouveau client', body: `${customer.firstName} ${customer.lastName} a passé sa première commande.`, link: '/admin/clients' }))
  return { order: M.toOrder(row, false), customer: M.toCustomer(updatedCustomer), guestKey: row.guestKey!, notifications }
}

/* ───────────────────────── Order lifecycle ───────────────────────── */

export async function advanceOrder(tx: TenantTx, tenantId: string, orderId: string, user: string, to?: OrderStatus): Promise<Changes> {
  const o = await orderRow(tx, orderId)
  if (o.channel !== 'web') throw conflict('Seules les commandes en ligne ont un circuit de préparation')
  const cur = FLOW.indexOf(o.status as OrderStatus)
  if (cur < 0 || o.status === 'livree') throw conflict('Cette commande est déjà clôturée')
  const next = to ?? FLOW[cur + 1]
  if (FLOW.indexOf(next) <= cur) throw conflict('Transition de statut invalide')

  const changes: Changes = { lots: [], movements: [], notifications: [] }
  // Stock leaves the shelf when the parcel ships; until then it is only reserved.
  if (FLOW.indexOf(next) >= 2 && cur < 2) {
    const lots = await lockLots(tx, tenantId, o.storeId, [...new Set(o.items.map((i) => i.productId))])
    let current = lots
    for (const it of o.items) {
      const r = await consume(tx, current, { productId: it.productId, storeId: o.storeId, qty: it.qty, type: 'vente', note: `Expédition ${o.number}`, user })
      current = r.lots
      changes.lots!.push(...r.changed)
      changes.movements!.push(...r.moves)
    }
    changes.notifications!.push(await notify(tx, { type: 'expedition', title: 'Commande expédiée', body: `${o.number} remise au transporteur.`, link: `/admin/commandes/${o.id}` }))
  }
  const delivery = (o.delivery ?? {}) as Record<string, string>
  const updated = await tx.order.update({
    where: { id: o.id },
    data: {
      status: next,
      paymentStatus: next === 'livree' && o.paymentMethod === 'livraison' ? 'paye' : o.paymentStatus,
      delivery: next === 'expediee' ? { ...delivery, carrier: delivery.carrier ?? 'Coursier interne', tracking: delivery.tracking ?? `TRK${Math.floor(Math.random() * 900000 + 100000)}` } : o.delivery ?? undefined,
      history: [...(o.history as object[]), { status: next, date: new Date().toISOString() }],
    },
    include: { items: true },
  })
  return { ...changes, orders: [M.toOrder(updated)] }
}

export async function cancelOrder(tx: TenantTx, tenant: Tenant, orderId: string): Promise<Changes> {
  const o = await orderRow(tx, orderId)
  if (o.status !== 'recue' && o.status !== 'preparation') throw conflict('Une commande expédiée ne peut plus être annulée')
  const updated = await tx.order.update({
    where: { id: o.id },
    data: { status: 'annulee', paymentStatus: o.paymentStatus === 'paye' ? 'rembourse' : o.paymentStatus, history: [...(o.history as object[]), { status: 'annulee', date: new Date().toISOString() }] },
    include: { items: true },
  })
  // Give back loyalty points spent / earned on the cancelled order.
  const customers = []
  if (o.customerId) {
    const c = await tx.customer.findFirst({ where: { id: o.customerId } })
    const earned = Math.floor((Number(o.total) - Number(o.shipping)) * tenant.settings.pointsPerDh)
    if (c) customers.push(M.toCustomer(await tx.customer.update({ where: { id: c.id }, data: { points: Math.max(0, c.points + (o.pointsUsed ?? 0) - earned) } })))
  }
  return { orders: [M.toOrder(updated)], customers }
}

export async function markPaid(tx: TenantTx, orderId: string): Promise<Changes> {
  const o = await orderRow(tx, orderId)
  const updated = await tx.order.update({ where: { id: o.id }, data: { paymentStatus: 'paye' }, include: { items: true } })
  return { orders: [M.toOrder(updated)] }
}

/* ───────────────────────── POS ───────────────────────── */

export interface PosSaleInput { storeId: string; lines: { productId: string; qty: number }[]; discount: number; method: 'carte' | 'especes'; customerId?: string; pointsUsed?: number }

export async function posSale(tx: TenantTx, tenant: Tenant, staff: { name: string; canDiscount: boolean }, input: PosSaleInput): Promise<Changes & { order: Order }> {
  if (!input.lines.length) throw badRequest('Panier vide')
  if (input.discount > 0 && !staff.canDiscount) throw forbidden('Vous n’êtes pas autorisé à accorder des remises')
  const d = await pricingData(tx)
  if (!d.stores.some((s) => s.id === input.storeId)) throw notFound('Boutique introuvable')

  // Prices come from the catalogue and live promotions, never from the terminal.
  const lines = input.lines.map((l) => {
    const p = d.products.find((x) => x.id === l.productId)
    if (!p || !p.active) throw badRequest('Produit inconnu ou archivé')
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw badRequest('Quantité invalide')
    return { productId: p.id, qty: l.qty, unitPrice: priceOf(d, p).price, unitCost: p.purchasePrice }
  })
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  if (input.discount < 0 || input.discount > subtotal) throw badRequest('Remise invalide')

  let customer = null
  let pointsDiscount = 0
  if (input.customerId) {
    customer = await tx.customer.findFirst({ where: { id: input.customerId } })
    if (!customer) throw notFound('Client introuvable')
    const pts = input.pointsUsed ?? 0
    const maxPts = Math.min(customer.points, Math.floor(((subtotal - input.discount) * 0.5) / tenant.settings.pointValue))
    if (pts < 0 || pts > maxPts) throw badRequest(`Points utilisables : ${maxPts} maximum`)
    pointsDiscount = Math.round(pts * tenant.settings.pointValue)
  }
  const total = Math.max(0, subtotal - input.discount - pointsDiscount)

  const number = await nextNumber(tx, 'POS')
  const ids = [...new Set(lines.map((l) => l.productId))]
  let lots = await lockLots(tx, tenant.id, input.storeId, ids)
  const changes: Changes = { lots: [], movements: [], notifications: [] }
  for (const l of lines) {
    const before = lots.filter((x) => x.productId === l.productId).reduce((s, x) => s + x.qty, 0)
    const r = await consume(tx, lots, { productId: l.productId, storeId: input.storeId, qty: l.qty, type: 'vente', note: `Vente caisse ${number}`, user: staff.name })
    lots = r.lots
    changes.lots!.push(...r.changed)
    changes.movements!.push(...r.moves)
    changes.notifications!.push(...(await lowStockCheck(tx, l.productId, input.storeId, before, before - l.qty)))
  }
  const now = new Date()
  const row = await tx.order.create({
    data: {
      id: newId('o'), number, channel: 'pos', storeId: input.storeId, customerId: customer?.id ?? null, subtotal: dec(subtotal),
      discount: dec(input.discount + pointsDiscount), shipping: dec(0), total: dec(total), pointsUsed: input.pointsUsed || null, status: 'livree',
      paymentMethod: input.method, paymentStatus: 'paye', history: [{ status: 'livree', date: now.toISOString() }], cashier: staff.name, createdAt: now,
      items: itemsCreate(lines),
    } as unknown as Prisma.OrderUncheckedCreateInput,
    include: { items: true },
  })
  if (customer) {
    const c = await tx.customer.update({ where: { id: customer.id }, data: { points: customer.points - (input.pointsUsed ?? 0) + Math.floor(total * tenant.settings.pointsPerDh) } })
    changes.customers = [M.toCustomer(c)]
  }
  const order = M.toOrder(row)
  return { ...changes, orders: [order], order }
}

export async function posReturn(tx: TenantTx, tenant: Tenant, user: string, orderId: string, items: { productId: string; qty: number }[], mode: 'remboursement' | 'avoir'): Promise<Changes> {
  const o = await orderRow(tx, orderId)
  if (o.returnOf) throw conflict('Impossible de retourner un ticket de retour')
  if (o.status === 'annulee') throw conflict('Commande annulée')
  const previous = await tx.order.findMany({ where: { returnOf: o.id }, include: { items: true } })
  const already = (pid: string) => previous.reduce((s, r) => s - r.items.filter((i) => i.productId === pid).reduce((a, i) => a + i.qty, 0), 0)
  const valid = items.filter((i) => i.qty > 0)
  if (!valid.length) throw badRequest('Aucun article à retourner')

  const changes: Changes = { lots: [], movements: [] }
  let refund = 0
  const lines: Order['items'] = []
  for (const it of valid) {
    const line = o.items.find((i) => i.productId === it.productId)
    if (!line) throw badRequest('Article absent de ce ticket')
    if (it.qty > line.qty - already(it.productId)) throw conflict(`Quantité retournable dépassée (déjà retourné : ${already(it.productId)})`)
    refund += Number(line.unitPrice) * it.qty
    lines.push({ productId: it.productId, qty: -it.qty, unitPrice: Number(line.unitPrice), unitCost: Number(line.unitCost) })
    const lots = await lockLots(tx, tenant.id, o.storeId, [it.productId])
    const target = [...lots].sort((a, b) => b.expiresAt.localeCompare(a.expiresAt))[0]
    if (!target) continue
    const lot = await tx.lot.update({ where: { id: target.id }, data: { qty: target.qty + it.qty } })
    const mv = await tx.movement.create({ data: { id: newId('mv'), date: new Date(), type: 'retour', productId: it.productId, lotId: target.id, storeId: o.storeId, qty: it.qty, note: `Retour ${o.number} (${mode})`, user } as unknown as Prisma.MovementUncheckedCreateInput })
    changes.lots!.push(M.toLot(lot))
    changes.movements!.push(M.toMovement(mv))
  }
  const now = new Date()
  const ret = await tx.order.create({
    data: {
      id: newId('o'), number: await nextNumber(tx, 'RET'), channel: 'pos', storeId: o.storeId, customerId: o.customerId, subtotal: dec(-refund), discount: dec(0),
      shipping: dec(0), total: dec(-refund), status: 'livree', paymentMethod: o.paymentMethod, paymentStatus: mode === 'remboursement' ? 'rembourse' : 'paye',
      history: [{ status: 'livree', date: now.toISOString() }], cashier: user, createdAt: now, returnOf: o.id, items: itemsCreate(lines),
    } as unknown as Prisma.OrderUncheckedCreateInput,
    include: { items: true },
  })
  if (o.customerId) {
    const c = await tx.customer.findFirst({ where: { id: o.customerId } })
    if (c) changes.customers = [M.toCustomer(await tx.customer.update({ where: { id: c.id }, data: { points: Math.max(0, c.points - Math.floor(refund * tenant.settings.pointsPerDh)) } }))]
  }
  return { ...changes, orders: [M.toOrder(ret)] }
}
