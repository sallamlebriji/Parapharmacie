import { seedAll } from '../../src/data/seed.js'
import { config } from './config.js'
import { prisma } from './db.js'
import { hashPassword } from './auth.js'
import { insertTenant } from './domain/importer.js'

/**
 * Resets the database and loads the demo dataset: two isolated parapharmacies (Sève, 3 stores;
 * Atlas, 1 store in trial), their employees for every role, customers, 6 months of sales…
 * All demo accounts use DEMO_PASSWORD from server/.env.
 */
async function main() {
  if (!config.demoPassword) throw new Error('DEMO_PASSWORD manquant dans server/.env')
  const t0 = Date.now()
  const tables = ['OrderItem', 'Order', 'AuditLog', 'AnalyticsDaily', 'Wishlist', 'ChatThread', 'Notification', 'Expense', 'Campaign', 'DeliveryZone', 'Review', 'Article', 'Pack', 'Promotion', 'PurchaseOrder', 'Supplier', 'Customer', 'Movement', 'Lot', 'Product', 'Store', 'User', 'Tenant']
  for (const t of tables) await prisma.$executeRawUnsafe(`DELETE FROM \`${t}\``)

  const hash = await hashPassword(config.demoPassword)
  const { tenants, data } = seedAll()
  for (const t of tenants) {
    await insertTenant(t, data[t.id], { staffPasswordHash: hash, customerPasswordHash: hash })
    console.log(`✓ ${t.name} : ${data[t.id].products.length} produits, ${data[t.id].orders.length} ventes, ${data[t.id].customers.length} clients`)
  }
  await prisma.user.create({ data: { id: 'op_1', tenantId: null, email: config.operatorEmail, name: 'Opérateur Paraflow', role: 'admin', isOperator: true, passwordHash: hash } })

  const staff = await prisma.user.findMany({ where: { isOperator: false }, orderBy: { tenantId: 'asc' }, select: { email: true, role: true, tenantId: true } })
  console.log('\nComptes de démonstration (mot de passe : DEMO_PASSWORD de server/.env) :')
  staff.forEach((u) => console.log(`  ${u.tenantId === 't_seve' ? 'Sève ' : 'Atlas'}  ${u.role.padEnd(12)} ${u.email}`))
  console.log(`  Opérateur    ${config.operatorEmail}`)
  const c = await prisma.customer.findFirst({ where: { tenantId: 't_seve', points: { gt: 200 } }, orderBy: { points: 'desc' } })
  if (c) console.log(`  Client boutique Sève : ${c.email}`)
  console.log(`\nTerminé en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
}

main().finally(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1) })
