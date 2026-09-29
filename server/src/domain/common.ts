import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import type { AppNotification, TenantData } from '../../../src/lib/types.js'
import type { TenantDb, TenantTx } from '../db.js'
import * as M from '../mappers.js'

export const newId = (p: string) => `${p}_${randomUUID().replace(/-/g, '').slice(0, 16)}`

/** Mutation responses carry the rows that changed so the SPA can merge them without reloading everything. */
export type Changes = Partial<Record<keyof TenantData, unknown[]>>
export interface Result<R = unknown> { changes: Changes; result?: R }

export function merge(...parts: Changes[]): Changes {
  const out: Changes = {}
  for (const p of parts) for (const [k, v] of Object.entries(p) as [keyof TenantData, unknown[]][]) out[k] = [...(out[k] ?? []), ...v]
  return out
}

export async function notify(tx: TenantTx | TenantDb, n: Omit<AppNotification, 'id' | 'date' | 'read'>) {
  const row = await tx.notification.create({ data: { id: newId('n'), type: n.type, title: n.title, body: n.body, link: n.link ?? null, date: new Date(), read: false } as unknown as Prisma.NotificationUncheckedCreateInput })
  return M.toNotification(row)
}

/** Next sequential document number (WEB-10001, POS-…, RET-…) for this tenant. */
export async function nextNumber(tx: TenantTx, prefix: string) {
  const last = await tx.order.findFirst({ where: { number: { startsWith: prefix + '-' } }, orderBy: { number: 'desc' }, select: { number: true } })
  return `${prefix}-${(last ? Number(last.number.split('-')[1]) : 10000) + 1}`
}

/** Retries a transaction when two concurrent writers raced for the same document number. */
export async function withRetry<X>(fn: () => Promise<X>, tries = 3): Promise<X> {
  for (let i = 0; ; i++) {
    try { return await fn() } catch (e) {
      if (i < tries - 1 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue
      throw e
    }
  }
}

/** Minimal TenantData slice needed by the shared pricing / cart rules. */
export async function pricingData(tx: TenantTx | TenantDb): Promise<TenantData> {
  const [products, packs, promotions, zones, stores] = await Promise.all([
    tx.product.findMany(), tx.pack.findMany(), tx.promotion.findMany(), tx.deliveryZone.findMany(), tx.store.findMany({ orderBy: { openedAt: 'asc' } }),
  ])
  return {
    products: products.map((p) => M.toProduct(p)), packs: packs.map(M.toPack), promotions: promotions.map(M.toPromotion), zones: zones.map(M.toZone),
    stores: stores.map(M.toStore), lots: [], movements: [], orders: [], customers: [], suppliers: [], purchaseOrders: [], articles: [], reviews: [],
    employees: [], campaigns: [], expenses: [], notifications: [], chats: [], permissions: {} as TenantData['permissions'], analytics: [],
  }
}

export const dec = (n: number) => new Prisma.Decimal(Math.round(n * 100) / 100)
