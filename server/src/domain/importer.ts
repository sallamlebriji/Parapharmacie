import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../db.js'
import type { Tenant, TenantData } from '../../../src/lib/types.js'
import { dec } from './common.js'

const d = (s: string) => new Date(s)
const chunks = <X>(a: X[], n = 800) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

/**
 * Writes a complete tenant (as produced by the demo generator or the signup starter kit) into MySQL.
 * Uses the unscoped client on purpose and sets tenantId explicitly on every row.
 */
export async function insertTenant(t: Tenant, data: TenantData, opts: { staffPasswordHash: string; customerPasswordHash?: string | null; staffEmails?: Record<string, string> }, db: Prisma.TransactionClient | PrismaClient = prisma) {
  const tenantId = t.id
  const T = { tenantId }
  await db.tenant.create({ data: { id: t.id, slug: t.slug, name: t.name, tagline: t.tagline, primaryColor: t.primaryColor, plan: t.plan, status: t.status, trialEndsAt: d(t.trialEndsAt), createdAt: d(t.createdAt), settings: t.settings, permissions: data.permissions } })
  await db.store.createMany({ data: data.stores.map((s) => ({ ...s, ...T })) })
  await db.user.createMany({
    data: data.employees.map((e) => ({ id: e.id, ...T, email: (opts.staffEmails?.[e.id] ?? e.email).toLowerCase(), name: e.name, role: e.role, storeId: e.storeId, active: e.active, passwordHash: opts.staffPasswordHash, lastLogin: d(e.lastLogin) })),
  })
  await db.supplier.createMany({ data: data.suppliers.map((s) => ({ ...s, ...T, brands: s.brands })) })
  await db.product.createMany({
    data: data.products.map((p) => ({ ...p, ...T, purchasePrice: dec(p.purchasePrice), price: dec(p.price), promoPrice: p.promoPrice ? dec(p.promoPrice) : null, isNew: !!p.isNew, createdAt: d(p.createdAt) })),
  })
  for (const c of chunks(data.lots)) await db.lot.createMany({ data: c.map((l) => ({ ...l, ...T, receivedAt: d(l.receivedAt), expiresAt: d(l.expiresAt) })) })
  for (const c of chunks(data.movements)) await db.movement.createMany({ data: c.map((m) => ({ ...m, ...T, date: d(m.date), lotId: m.lotId ?? null, toStoreId: m.toStoreId ?? null })) })
  for (const c of chunks(data.customers)) {
    await db.customer.createMany({ data: c.map((x) => ({ ...x, ...T, createdAt: d(x.createdAt), skinType: x.skinType ?? null, passwordHash: opts.customerPasswordHash ?? null })) })
  }
  for (const c of chunks(data.orders, 500)) {
    await db.order.createMany({
      data: c.map((o): Prisma.OrderCreateManyInput => ({
        id: o.id, ...T, number: o.number, channel: o.channel, storeId: o.storeId, customerId: o.customerId ?? null, subtotal: dec(o.subtotal), discount: dec(o.discount),
        shipping: dec(o.shipping), total: dec(o.total), couponCode: o.couponCode ?? null, pointsUsed: o.pointsUsed ?? null, status: o.status,
        paymentMethod: o.payment.method, paymentStatus: o.payment.status, delivery: o.delivery ?? undefined, history: o.history, cashier: o.cashier ?? null, createdAt: d(o.createdAt),
      })),
    })
    await db.orderItem.createMany({ data: c.flatMap((o) => o.items.map((i) => ({ orderId: o.id, productId: i.productId, qty: i.qty, unitPrice: dec(i.unitPrice), unitCost: dec(i.unitCost) }))) })
  }
  await db.purchaseOrder.createMany({ data: data.purchaseOrders.map((p) => ({ ...p, ...T, lines: p.lines as unknown as Prisma.InputJsonValue, invoice: p.invoice ?? undefined, createdAt: d(p.createdAt), expectedAt: d(p.expectedAt) })) })
  await db.promotion.createMany({ data: data.promotions.map((p) => ({ ...p, ...T, value: dec(p.value), minAmount: p.minAmount ? dec(p.minAmount) : null, code: p.code ?? null, target: p.target ?? null, buyX: p.buyX ?? null, getY: p.getY ?? null, highlight: !!p.highlight, startsAt: d(p.startsAt), endsAt: d(p.endsAt) })) })
  await db.pack.createMany({ data: data.packs.map((p) => ({ ...p, ...T, price: dec(p.price) })) })
  await db.article.createMany({ data: data.articles.map((a) => ({ ...a, ...T, date: d(a.date) })) })
  for (const c of chunks(data.reviews)) await db.review.createMany({ data: c.map((r) => ({ ...r, ...T, hasPhoto: !!r.hasPhoto, date: d(r.date) })) })
  await db.deliveryZone.createMany({ data: data.zones.map((z) => ({ ...z, ...T, standardFee: dec(z.standardFee), expressFee: dec(z.expressFee), freeAbove: dec(z.freeAbove) })) })
  await db.campaign.createMany({ data: data.campaigns.map((c) => ({ ...c, ...T, revenue: dec(c.revenue), date: d(c.date) })) })
  await db.expense.createMany({ data: data.expenses.map((e) => ({ ...e, ...T, amount: dec(e.amount), date: d(e.date) })) })
  await db.notification.createMany({ data: data.notifications.map((n) => ({ ...n, ...T, link: n.link ?? null, date: d(n.date) })) })
  await db.chatThread.createMany({ data: data.chats.map((c) => ({ ...c, ...T, messages: c.messages })) })
  await db.analyticsDaily.createMany({ data: data.analytics.map((a) => ({ ...a, ...T })) })
}
