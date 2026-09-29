import type { Prisma } from '@prisma/client'
import type { PurchaseLine } from '../../../src/lib/types.js'
import type { TenantTx } from '../db.js'
import { badRequest, conflict, notFound } from '../errors.js'
import * as M from '../mappers.js'
import { merge, newId, type Changes } from './common.js'
import { addLot } from './stock.js'

export async function savePurchaseOrder(tx: TenantTx, input: { id?: string; supplierId: string; storeId: string; expectedAt: string; lines: { productId: string; qty: number; unitCost: number }[]; status: 'brouillon' | 'envoyee' }): Promise<Changes> {
  if (!(await tx.supplier.findFirst({ where: { id: input.supplierId } }))) throw notFound('Fournisseur introuvable')
  if (!(await tx.store.findFirst({ where: { id: input.storeId } }))) throw notFound('Boutique introuvable')
  const lines = input.lines.filter((l) => l.qty > 0)
  if (input.status === 'envoyee' && !lines.length) throw badRequest('Ajoutez au moins une ligne avant l’envoi')
  const products = await tx.product.findMany({ where: { id: { in: lines.map((l) => l.productId) } }, select: { id: true } })
  if (products.length !== new Set(lines.map((l) => l.productId)).size) throw badRequest('Produit inconnu dans le bon de commande')
  const data = { supplierId: input.supplierId, storeId: input.storeId, expectedAt: new Date(input.expectedAt), status: input.status, lines: lines.map((l) => ({ ...l, received: 0 })) }

  if (input.id) {
    const po = await tx.purchaseOrder.findFirst({ where: { id: input.id } })
    if (!po) throw notFound('Bon de commande introuvable')
    if (po.status !== 'brouillon') throw conflict('Seul un brouillon peut être modifié')
    return { purchaseOrders: [M.toPO(await tx.purchaseOrder.update({ where: { id: po.id }, data }))] }
  }
  const count = await tx.purchaseOrder.count()
  const row = await tx.purchaseOrder.create({ data: { id: newId('po'), number: `BC-${new Date().getFullYear()}-${String(140 + count).padStart(4, '0')}`, createdAt: new Date(), ...data } as unknown as Prisma.PurchaseOrderUncheckedCreateInput })
  return { purchaseOrders: [M.toPO(row)] }
}

export async function sendPurchaseOrder(tx: TenantTx, id: string): Promise<Changes> {
  const po = await tx.purchaseOrder.findFirst({ where: { id } })
  if (!po) throw notFound('Bon de commande introuvable')
  if (po.status !== 'brouillon') throw conflict('Ce bon a déjà été envoyé')
  if (!(po.lines as unknown as PurchaseLine[]).length) throw badRequest('Bon de commande vide')
  return { purchaseOrders: [M.toPO(await tx.purchaseOrder.update({ where: { id }, data: { status: 'envoyee' } }))] }
}

/** Receiving goods creates the lots (with number and expiry) and the stock entries automatically. */
export async function receivePurchaseOrder(tx: TenantTx, id: string, receipts: { index: number; qty: number; lotNumber: string; expiresAt: string }[], user: string): Promise<Changes> {
  const po = await tx.purchaseOrder.findFirst({ where: { id } })
  if (!po) throw notFound('Bon de commande introuvable')
  if (po.status !== 'envoyee' && po.status !== 'partielle') throw conflict('Ce bon n’est pas en attente de réception')
  const lines = po.lines as unknown as PurchaseLine[]
  let changes: Changes = {}
  for (const r of receipts.filter((x) => x.qty > 0)) {
    const line = lines[r.index]
    if (!line) throw badRequest('Ligne de réception invalide')
    if (r.qty > line.qty - line.received) throw conflict(`Quantité reçue supérieure au reliquat (${line.qty - line.received})`)
    if (!r.lotNumber.trim()) throw badRequest('Numéro de lot obligatoire')
    if (new Date(r.expiresAt).getTime() <= Date.now()) throw badRequest('La date d’expiration doit être future')
    changes = merge(changes, await addLot(tx, { productId: line.productId, storeId: po.storeId, number: r.lotNumber.trim(), qty: r.qty, expiresAt: r.expiresAt, supplierId: po.supplierId, note: `Réception ${po.number}`, user }))
    line.received += r.qty
    line.lotNumber = r.lotNumber.trim()
    line.expiresAt = new Date(r.expiresAt).toISOString()
  }
  const complete = lines.every((l) => l.received >= l.qty)
  const amount = lines.reduce((a, l) => a + l.received * l.unitCost, 0)
  const invoice = (po.invoice as object | null) ?? { number: `FAC-${Math.floor(Math.random() * 9000 + 1000)}`, amount, paid: false, dueAt: new Date(Date.now() + 60 * 864e5).toISOString() }
  const updated = await tx.purchaseOrder.update({ where: { id }, data: { lines: lines as unknown as Prisma.InputJsonValue, status: complete ? 'recue' : 'partielle', invoice: { ...invoice, amount } } })
  return merge(changes, { purchaseOrders: [M.toPO(updated)] })
}

export async function payInvoice(tx: TenantTx, id: string): Promise<Changes> {
  const po = await tx.purchaseOrder.findFirst({ where: { id } })
  if (!po?.invoice) throw notFound('Facture introuvable')
  return { purchaseOrders: [M.toPO(await tx.purchaseOrder.update({ where: { id }, data: { invoice: { ...(po.invoice as object), paid: true } } }))] }
}
