import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

/** Models carrying a `tenantId` column. OrderItem is reached only through its (tenant-scoped) Order. */
const TENANT_MODELS = new Set([
  'User', 'Store', 'Product', 'Lot', 'Movement', 'Order', 'Customer', 'Supplier', 'PurchaseOrder', 'Promotion', 'Pack',
  'Article', 'Review', 'DeliveryZone', 'Campaign', 'Expense', 'Notification', 'ChatThread', 'Wishlist', 'AnalyticsDaily', 'AuditLog',
])

const WHERE_OPS = new Set([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy',
  'update', 'updateMany', 'delete', 'deleteMany',
])

/**
 * Tenant isolation. MySQL has no row-level security, so every query issued through this client
 * gets `tenantId` injected into its filter (reads, updates, deletes) and into its data (creates).
 * Any attempt to change a row's tenantId is dropped. Raw SQL is NOT covered: always pass tenantId
 * explicitly in `$queryRaw` / `$executeRaw`.
 */
export function tenantDb(tenantId: string) {
  return prisma.$extends({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = (args ?? {}) as any
          if (WHERE_OPS.has(operation)) a.where = { ...(a.where ?? {}), tenantId }
          if (operation === 'update' || operation === 'updateMany') { if (a.data) delete a.data.tenantId }
          if (operation === 'create') a.data = { ...a.data, tenantId }
          if (operation === 'createMany') a.data = (Array.isArray(a.data) ? a.data : [a.data]).map((d: object) => ({ ...d, tenantId }))
          if (operation === 'upsert') {
            a.where = { ...a.where, tenantId }
            a.create = { ...a.create, tenantId }
            if (a.update) delete a.update.tenantId
          }
          return query(a)
        },
      },
    },
  })
}

export type TenantDb = ReturnType<typeof tenantDb>
/** Transaction client of a tenant-scoped client (extensions still apply inside `$transaction`). */
export type TenantTx = Parameters<Parameters<TenantDb['$transaction']>[0]>[0]
