import { Router } from 'express'
import { requireOperator } from '../auth.js'
import { prisma } from '../db.js'
import { ah } from '../errors.js'
import { toTenant } from '../mappers.js'

/** SaaS provider console: subscriptions and usage counters only — never tenant business data. */
export const operatorRouter = Router()
operatorRouter.use(requireOperator)

operatorRouter.get('/tenants', ah(async (_req, res) => {
  const [tenants, stores, users, products] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.store.groupBy({ by: ['tenantId'], _count: true }),
    prisma.user.groupBy({ by: ['tenantId'], where: { active: true, isOperator: false }, _count: true }),
    prisma.product.groupBy({ by: ['tenantId'], _count: true }),
  ])
  const c = (rows: { tenantId: string | null; _count: number }[], id: string) => rows.find((r) => r.tenantId === id)?._count ?? 0
  res.json(tenants.map((t) => ({ ...toTenant(t), usage: { stores: c(stores, t.id), users: c(users, t.id), products: c(products, t.id) } })))
}))
