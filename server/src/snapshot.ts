import type { Permission, Role, TenantData } from '../../src/lib/types.js'
import { isLive, ordersInRange, productSales, stockIndex } from '../../src/lib/logic.js'
import type { TenantDb } from './db.js'
import * as M from './mappers.js'

const orderInclude = { items: true } as const

/** Everything the back-office needs, in the front-end TenantData shape. Costs are stripped for roles without `prix_achat.view`. */
export async function staffSnapshot(db: TenantDb, perms: Permission[], permissions: Record<Role, Permission[]>): Promise<TenantData> {
  const cost = perms.includes('prix_achat.view')
  const [stores, products, lots, movements, orders, customers, suppliers, pos, promotions, packs, articles, reviews, users, zones, campaigns, expenses, notifications, chats, analytics] = await Promise.all([
    db.store.findMany({ orderBy: { openedAt: 'asc' } }),
    db.product.findMany({ orderBy: { id: 'asc' } }),
    db.lot.findMany(),
    db.movement.findMany({ orderBy: { date: 'desc' }, take: 1500 }),
    db.order.findMany({ include: orderInclude, orderBy: { createdAt: 'desc' } }),
    db.customer.findMany({ orderBy: { createdAt: 'desc' } }),
    db.supplier.findMany(),
    db.purchaseOrder.findMany({ orderBy: { createdAt: 'desc' } }),
    db.promotion.findMany({ orderBy: { startsAt: 'desc' } }),
    db.pack.findMany(),
    db.article.findMany({ orderBy: { date: 'desc' } }),
    db.review.findMany({ orderBy: { date: 'desc' } }),
    db.user.findMany({ orderBy: { createdAt: 'asc' } }),
    db.deliveryZone.findMany(),
    db.campaign.findMany({ orderBy: { date: 'desc' } }),
    db.expense.findMany({ orderBy: { date: 'desc' } }),
    db.notification.findMany({ orderBy: { date: 'desc' }, take: 100 }),
    db.chatThread.findMany({ orderBy: { updatedAt: 'desc' } }),
    db.analyticsDaily.findMany({ orderBy: { date: 'asc' } }),
  ])
  return {
    stores: stores.map(M.toStore),
    products: products.map((p) => M.toProduct(p, cost)),
    lots: lots.map(M.toLot),
    movements: movements.map(M.toMovement),
    orders: orders.map((o) => M.toOrder(o, cost)),
    customers: customers.map(M.toCustomer),
    suppliers: suppliers.map(M.toSupplier),
    purchaseOrders: pos.map((p) => M.toPO(p, cost)),
    promotions: promotions.map(M.toPromotion),
    packs: packs.map(M.toPack),
    articles: articles.map(M.toArticle),
    reviews: reviews.map(M.toReview),
    employees: users.filter((u) => !u.isOperator).map(M.toEmployee),
    zones: zones.map(M.toZone),
    campaigns: campaigns.map(M.toCampaign),
    expenses: expenses.map(M.toExpense),
    notifications: notifications.map(M.toNotification),
    chats: chats.map(M.toChat),
    permissions,
    analytics: analytics.map((a) => ({ date: a.date, visits: a.visits, addToCart: a.addToCart, checkouts: a.checkouts })),
  }
}

/** Rows changed since a timestamp — polled by the back-office to stay in sync with POS and web activity. */
export async function staffChanges(db: TenantDb, perms: Permission[], since: Date) {
  const cost = perms.includes('prix_achat.view')
  const [orders, lots, movements, notifications, chats, customers, products] = await Promise.all([
    db.order.findMany({ where: { updatedAt: { gt: since } }, include: orderInclude }),
    db.lot.findMany({ where: { updatedAt: { gt: since } } }),
    db.movement.findMany({ where: { date: { gt: since } } }),
    db.notification.findMany({ where: { date: { gt: since } } }),
    db.chatThread.findMany({ where: { updatedAt: { gt: since } } }),
    db.customer.findMany({ where: { updatedAt: { gt: since } } }),
    db.product.findMany({ where: { updatedAt: { gt: since } } }),
  ])
  return {
    orders: orders.map((o) => M.toOrder(o, cost)), lots: lots.map(M.toLot), movements: movements.map(M.toMovement),
    notifications: notifications.map(M.toNotification), chats: chats.map(M.toChat), customers: customers.map(M.toCustomer),
    products: products.map((p) => M.toProduct(p, cost)),
  }
}

/**
 * Public storefront snapshot: active catalogue without purchase prices, live automatic promotions
 * (coupon codes are never listed), published reviews and precomputed insights. Orders, lots, other
 * customers and internal data are never included; the signed-in customer only gets their own records.
 */
export async function publicSnapshot(db: TenantDb, customerId: string | null): Promise<TenantData> {
  const since90 = new Date(Date.now() - 90 * 864e5)
  const [stores, products, lots, openOrders, recentOrders, promotions, packs, articles, reviews, zones, me, myOrders, myChats] = await Promise.all([
    db.store.findMany({ orderBy: { openedAt: 'asc' } }),
    db.product.findMany({ where: { active: true }, orderBy: { id: 'asc' } }),
    db.lot.findMany({ where: { qty: { gt: 0 } }, select: { productId: true, storeId: true, qty: true } }),
    db.order.findMany({ where: { channel: 'web', status: { in: ['recue', 'preparation'] } }, include: orderInclude }),
    db.order.findMany({ where: { createdAt: { gte: since90 }, status: { not: 'annulee' } }, include: orderInclude }),
    db.promotion.findMany({ where: { active: true, code: null } }),
    db.pack.findMany(),
    db.article.findMany({ orderBy: { date: 'desc' } }),
    db.review.findMany({ where: { status: 'publie' }, orderBy: { date: 'desc' } }),
    db.deliveryZone.findMany({ where: { active: true } }),
    customerId ? db.customer.findFirst({ where: { id: customerId } }) : null,
    customerId ? db.order.findMany({ where: { customerId }, include: orderInclude, orderBy: { createdAt: 'desc' } }) : [],
    customerId ? db.chatThread.findMany({ where: { customerId } }) : [],
  ])

  // Availability is computed for the web warehouse (first store), exactly as the back-office does.
  const web = stores[0]?.id
  const tmp = {
    stores: stores.map(M.toStore), products: products.map((p) => M.toProduct(p, false)),
    lots: lots.filter((l) => l.storeId === web).map((l, i) => ({ id: String(i), productId: l.productId, storeId: l.storeId, qty: l.qty, number: '', initialQty: 0, receivedAt: '', expiresAt: '', supplierId: '' })),
    orders: openOrders.map((o) => M.toOrder(o, false)),
  } as unknown as TenantData
  const idx = stockIndex(tmp, web ?? 'all')
  const available = Object.fromEntries(tmp.products.map((p) => [p.id, idx(p).available]))

  const recent = { orders: recentOrders.map((o) => M.toOrder(o, false)) } as TenantData
  const sold = Object.fromEntries([...productSales(ordersInRange(recent, 'all', 89)).entries()].map(([id, v]) => [id, v.qty]))
  const bestSellers = [...productSales(ordersInRange(recent, 'all', 29)).entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 16).map(([id]) => id)
  const co = new Map<string, Map<string, number>>()
  for (const o of recentOrders) {
    if (o.items.length < 2) continue
    for (const a of o.items) for (const b of o.items) {
      if (a.productId === b.productId) continue
      const m = co.get(a.productId) ?? new Map<string, number>()
      m.set(b.productId, (m.get(b.productId) ?? 0) + 1)
      co.set(a.productId, m)
    }
  }
  const together = Object.fromEntries([...co.entries()].map(([id, m]) => [id, [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k]) => k)]))

  return {
    stores: tmp.stores, products: tmp.products, lots: [], movements: [],
    orders: myOrders.map((o) => M.toOrder(o, false)),
    customers: me ? [M.toCustomer(me)] : [],
    suppliers: [], purchaseOrders: [],
    promotions: promotions.map(M.toPromotion).filter((p) => isLive(p)),
    packs: packs.map(M.toPack), articles: articles.map(M.toArticle), reviews: reviews.map(M.toReview),
    employees: [], zones: zones.map(M.toZone), campaigns: [], expenses: [], notifications: [],
    chats: myChats.map(M.toChat), permissions: {} as TenantData['permissions'], analytics: [],
    insights: { available, bestSellers, together, sold },
  }
}
