import type * as P from '@prisma/client'
import type * as T from '../../src/lib/types.js'

/*
 * Row → DTO mappers. The DTOs are exactly the front-end domain types (src/lib/types.ts), so the
 * React app and the shared business rules (src/lib/logic.ts) work unchanged on server data.
 */

type Dec = P.Prisma.Decimal | number | null | undefined
const n = (d: Dec) => (d === null || d === undefined ? 0 : Number(d))
const nOpt = (d: Dec) => (d === null || d === undefined ? undefined : Number(d))
const iso = (d: Date) => d.toISOString()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = <X>(v: P.Prisma.JsonValue): X => v as any as X

export const toTenant = (t: P.Tenant): T.Tenant => ({
  id: t.id, name: t.name, slug: t.slug, tagline: t.tagline, primaryColor: t.primaryColor, plan: t.plan as T.PlanId,
  status: t.status as T.Tenant['status'], trialEndsAt: iso(t.trialEndsAt), createdAt: iso(t.createdAt), settings: j(t.settings),
})

export const toStore = (s: P.Store): T.Store => ({ id: s.id, name: s.name, city: s.city, address: s.address, phone: s.phone, manager: s.manager, openedAt: s.openedAt })

export const toProduct = (p: P.Product, showCost = true): T.Product => ({
  id: p.id, name: p.name, brand: p.brand, ref: p.ref, barcode: p.barcode, category: p.category as T.CategoryId, subcategory: p.subcategory,
  needs: j(p.needs), skinTypes: j(p.skinTypes), description: p.description, composition: p.composition, usage: p.usage, warnings: p.warnings,
  purchasePrice: showCost ? n(p.purchasePrice) : 0, price: n(p.price), promoPrice: nOpt(p.promoPrice), alertThreshold: p.alertThreshold,
  supplierId: p.supplierId, shape: p.shape as T.Shape, color: p.color, volume: p.volume, rating: p.rating, reviewsCount: p.reviewsCount,
  isNew: p.isNew, createdAt: iso(p.createdAt), active: p.active,
})

export const toLot = (l: P.Lot): T.Lot => ({ id: l.id, productId: l.productId, storeId: l.storeId, number: l.number, qty: l.qty, initialQty: l.initialQty, receivedAt: iso(l.receivedAt), expiresAt: iso(l.expiresAt), supplierId: l.supplierId })

export const toMovement = (m: P.Movement): T.Movement => ({
  id: m.id, date: iso(m.date), type: m.type as T.MovementType, productId: m.productId, lotId: m.lotId ?? undefined, storeId: m.storeId,
  toStoreId: m.toStoreId ?? undefined, qty: m.qty, note: m.note, user: m.user,
})

export type OrderRow = P.Order & { items: P.OrderItem[] }
export const toOrder = (o: OrderRow, showCost = true): T.Order => ({
  id: o.id, number: o.number, channel: o.channel as T.Order['channel'], storeId: o.storeId, customerId: o.customerId ?? undefined,
  items: o.items.map((i) => ({ productId: i.productId, qty: i.qty, unitPrice: n(i.unitPrice), unitCost: showCost ? n(i.unitCost) : 0 })),
  subtotal: n(o.subtotal), discount: n(o.discount), shipping: n(o.shipping), total: n(o.total), couponCode: o.couponCode ?? undefined,
  pointsUsed: o.pointsUsed ?? undefined, status: o.status as T.OrderStatus,
  payment: { method: o.paymentMethod as T.Order['payment']['method'], status: o.paymentStatus as T.PaymentStatus },
  delivery: (o.delivery as T.Order['delivery']) ?? undefined, history: j(o.history), createdAt: iso(o.createdAt), cashier: o.cashier ?? undefined,
})

export const toCustomer = (c: P.Customer): T.Customer => ({
  id: c.id, firstName: c.firstName, lastName: c.lastName, phone: c.phone, email: c.email, address: c.address, city: c.city,
  createdAt: iso(c.createdAt), points: c.points, couponsUsed: j(c.couponsUsed), favorites: j(c.favorites), skinType: c.skinType ?? undefined,
  marketingOptIn: c.marketingOptIn,
})

export const toSupplier = (s: P.Supplier): T.Supplier => ({ id: s.id, name: s.name, contact: s.contact, email: s.email, phone: s.phone, city: s.city, paymentTerms: s.paymentTerms, brands: j(s.brands) })

export const toPO = (p: P.PurchaseOrder, showCost = true): T.PurchaseOrder => ({
  id: p.id, number: p.number, supplierId: p.supplierId, storeId: p.storeId, status: p.status as T.POStatus,
  lines: j<T.PurchaseLine[]>(p.lines).map((l) => ({ ...l, unitCost: showCost ? l.unitCost : 0 })),
  createdAt: iso(p.createdAt), expectedAt: iso(p.expectedAt), invoice: (p.invoice as T.PurchaseOrder['invoice']) ?? undefined,
})

export const toPromotion = (p: P.Promotion): T.Promotion => ({
  id: p.id, name: p.name, code: p.code ?? undefined, type: p.type as T.PromoType, value: n(p.value), target: p.target ?? undefined,
  buyX: p.buyX ?? undefined, getY: p.getY ?? undefined, minAmount: nOpt(p.minAmount), startsAt: iso(p.startsAt), endsAt: iso(p.endsAt),
  active: p.active, uses: p.uses, highlight: p.highlight,
})

export const toPack = (p: P.Pack): T.Pack => ({ id: p.id, slug: p.slug, name: p.name, kind: p.kind as T.Pack['kind'], tagline: p.tagline, description: p.description, productIds: j(p.productIds), price: n(p.price), steps: j(p.steps) })

export const toArticle = (a: P.Article): T.Article => ({ id: a.id, slug: a.slug, title: a.title, category: a.category, excerpt: a.excerpt, body: j(a.body), readTime: a.readTime, date: iso(a.date), cover: a.cover, productIds: j(a.productIds) })

export const toReview = (r: P.Review): T.Review => ({ id: r.id, productId: r.productId, author: r.author, rating: r.rating, title: r.title, text: r.text, date: iso(r.date), verified: r.verified, hasPhoto: r.hasPhoto, status: r.status as T.Review['status'] })

export const toEmployee = (u: P.User): T.Employee => ({ id: u.id, name: u.name, email: u.email, role: u.role as T.Role, storeId: u.storeId ?? '', active: u.active, lastLogin: iso(u.lastLogin ?? u.createdAt) })

export const toZone = (z: P.DeliveryZone): T.DeliveryZone => ({ id: z.id, name: z.name, cities: j(z.cities), standardFee: n(z.standardFee), expressFee: n(z.expressFee), freeAbove: n(z.freeAbove), standardDelay: z.standardDelay, expressDelay: z.expressDelay, active: z.active })

export const toCampaign = (c: P.Campaign): T.Campaign => ({ id: c.id, name: c.name, channel: c.channel as T.Campaign['channel'], segment: c.segment, status: c.status as T.Campaign['status'], sent: c.sent, opened: c.opened, clicked: c.clicked, revenue: n(c.revenue), date: iso(c.date), subject: c.subject })

export const toExpense = (e: P.Expense): T.Expense => ({ id: e.id, date: iso(e.date), label: e.label, category: e.category, amount: n(e.amount), storeId: e.storeId })

export const toNotification = (x: P.Notification): T.AppNotification => ({ id: x.id, type: x.type as T.AppNotification['type'], title: x.title, body: x.body, date: iso(x.date), read: x.read, link: x.link ?? undefined })

export const toChat = (c: P.ChatThread): T.ChatThread => ({ id: c.id, customer: c.customer, subject: c.subject, topic: c.topic as T.ChatThread['topic'], messages: j(c.messages), status: c.status as T.ChatThread['status'] })

export const toWishlist = (w: P.Wishlist): T.Wishlist => ({ id: w.id, name: w.name, productIds: j(w.productIds), alerts: j(w.alerts) })
