import { Prisma } from '@prisma/client'
import { consumeFEFO } from '../../../src/lib/logic.js'
import type { Lot, Movement } from '../../../src/lib/types.js'
import type { TenantTx } from '../db.js'
import { conflict, notFound } from '../errors.js'
import * as M from '../mappers.js'
import { newId, notify, type Changes } from './common.js'

/**
 * Locks the lots of the given products in one store for the duration of the transaction, so two
 * concurrent sales (POS + web shipping) can never consume the same units.
 */
export async function lockLots(tx: TenantTx, tenantId: string, storeId: string, productIds: string[]) {
  if (!productIds.length) return [] as Lot[]
  await tx.$queryRaw`SELECT id FROM Lot WHERE tenantId = ${tenantId} AND storeId = ${storeId} AND productId IN (${Prisma.join(productIds)}) FOR UPDATE`
  return (await tx.lot.findMany({ where: { storeId, productId: { in: productIds } } })).map(M.toLot)
}

/** Takes `qty` units FEFO from locked lots and persists lot quantities + movements. */
export async function consume(tx: TenantTx, lots: Lot[], a: { productId: string; storeId: string; qty: number; type: Movement['type']; note: string; user: string; allowPartial?: boolean }) {
  const r = consumeFEFO(lots, a.productId, a.storeId, a.qty, a.type, a.note, a.user)
  if (r.shortfall > 0 && !a.allowPartial) {
    const p = await tx.product.findFirst({ where: { id: a.productId }, select: { name: true } })
    throw conflict(`Stock insuffisant pour « ${p?.name ?? a.productId} » (manque ${r.shortfall})`)
  }
  const changed = r.lots.filter((l) => lots.find((o) => o.id === l.id)?.qty !== l.qty)
  for (const l of changed) await tx.lot.update({ where: { id: l.id }, data: { qty: l.qty } })
  const moves = r.moves.map((m) => ({ ...m, id: newId('mv') }))
  if (moves.length) await tx.movement.createMany({ data: moves.map((m) => ({ ...m, date: new Date(m.date), lotId: m.lotId ?? null, toStoreId: m.toStoreId ?? null })) as Prisma.MovementCreateManyInput[] })
  return { lots: r.lots, changed, moves, shortfall: r.shortfall }
}

/** Emits a « stock faible » notification when a store crosses its alert threshold. */
export async function lowStockCheck(tx: TenantTx, productId: string, _storeId: string, before: number, after: number) {
  const p = await tx.product.findFirst({ where: { id: productId } })
  if (p && after <= p.alertThreshold && before > p.alertThreshold) {
    return [await notify(tx, { type: 'stock', title: 'Stock faible', body: `${p.name} : ${after} unité(s) restante(s) en boutique.`, link: '/admin/stock' })]
  }
  return []
}

export async function addLot(tx: TenantTx, input: { productId: string; storeId: string; number: string; qty: number; expiresAt: string; supplierId?: string; note?: string; user: string }): Promise<Changes> {
  const p = await tx.product.findFirst({ where: { id: input.productId } })
  if (!p) throw notFound('Produit introuvable')
  if (!(await tx.store.findFirst({ where: { id: input.storeId } }))) throw notFound('Boutique introuvable')
  const before = await tx.lot.aggregate({ where: { productId: p.id }, _sum: { qty: true } })
  const lot = await tx.lot.create({ data: { id: newId('lot'), productId: p.id, storeId: input.storeId, number: input.number, qty: input.qty, initialQty: input.qty, receivedAt: new Date(), expiresAt: new Date(input.expiresAt), supplierId: input.supplierId ?? p.supplierId } as unknown as Prisma.LotUncheckedCreateInput })
  const mv = await tx.movement.create({ data: { id: newId('mv'), date: new Date(), type: 'entree', productId: p.id, lotId: lot.id, storeId: input.storeId, qty: input.qty, note: input.note ?? `Entrée lot ${input.number}`, user: input.user } as unknown as Prisma.MovementUncheckedCreateInput })
  const notifications = (before._sum.qty ?? 0) <= 0 ? [await notify(tx, { type: 'retour_stock', title: 'Produit de nouveau disponible', body: `${p.name} — les clients en attente ont été prévenus.`, link: '/admin/stock' })] : []
  return { lots: [M.toLot(lot)], movements: [M.toMovement(mv)], notifications }
}

export async function adjust(tx: TenantTx, tenantId: string, a: { productId: string; storeId: string; delta: number; note: string; type?: Movement['type']; user: string }): Promise<Changes> {
  const lots = await lockLots(tx, tenantId, a.storeId, [a.productId])
  if (!lots.length) throw notFound('Aucun lot pour ce produit dans cette boutique — utilisez une entrée de stock')
  const type = a.type ?? 'ajustement'
  if (a.delta < 0) {
    const r = await consume(tx, lots, { productId: a.productId, storeId: a.storeId, qty: -a.delta, type, note: a.note, user: a.user, allowPartial: true })
    return { lots: r.changed, movements: r.moves }
  }
  const target = [...lots].sort((x, y) => y.expiresAt.localeCompare(x.expiresAt))[0]
  const lot = await tx.lot.update({ where: { id: target.id }, data: { qty: target.qty + a.delta } })
  const mv = await tx.movement.create({ data: { id: newId('mv'), date: new Date(), type, productId: a.productId, lotId: target.id, storeId: a.storeId, qty: a.delta, note: a.note, user: a.user } as unknown as Prisma.MovementUncheckedCreateInput })
  return { lots: [M.toLot(lot)], movements: [M.toMovement(mv)] }
}

export async function inventory(tx: TenantTx, tenantId: string, a: { productId: string; storeId: string; counted: number; user: string }): Promise<Changes> {
  const lots = await lockLots(tx, tenantId, a.storeId, [a.productId])
  const current = lots.reduce((s, l) => s + l.qty, 0)
  if (a.counted === current) return {}
  return adjust(tx, tenantId, { productId: a.productId, storeId: a.storeId, delta: a.counted - current, note: `Inventaire : ${current} → ${a.counted}`, type: 'inventaire', user: a.user })
}

export async function transfer(tx: TenantTx, tenantId: string, a: { productId: string; from: string; to: string; qty: number; user: string }): Promise<Changes> {
  if (a.from === a.to) throw conflict('Les boutiques de départ et d’arrivée doivent être différentes')
  const dest = await tx.store.findFirst({ where: { id: a.to } })
  if (!dest) throw notFound('Boutique de destination introuvable')
  const lots = await lockLots(tx, tenantId, a.from, [a.productId])
  const r = await consume(tx, lots, { productId: a.productId, storeId: a.from, qty: a.qty, type: 'transfert', note: `Transfert vers ${dest.name}`, user: a.user })
  const created: Lot[] = []
  for (const m of r.moves) {
    const src = lots.find((l) => l.id === m.lotId)!
    const row = await tx.lot.create({ data: { id: newId('lot'), productId: src.productId, storeId: a.to, number: src.number, qty: -m.qty, initialQty: -m.qty, receivedAt: new Date(), expiresAt: new Date(src.expiresAt), supplierId: src.supplierId } as unknown as Prisma.LotUncheckedCreateInput })
    created.push(M.toLot(row))
    await tx.movement.update({ where: { id: m.id }, data: { toStoreId: a.to } })
  }
  return { lots: [...r.changed, ...created], movements: r.moves.map((m) => ({ ...m, toStoreId: a.to })) }
}
