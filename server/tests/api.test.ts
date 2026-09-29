/**
 * Integration tests against a real MySQL database (DATABASE_URL_TEST, default `paraflow_test`).
 * The schema is pushed and the demo dataset seeded before the suite runs.
 */
import { execSync } from 'node:child_process'
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import 'dotenv/config'

const TEST_DB = process.env.DATABASE_URL_TEST ?? (process.env.DATABASE_URL ?? '').replace(/\/[^/?]+(\?|$)/, '/paraflow_test$1')
process.env.DATABASE_URL = TEST_DB
const PASSWORD = process.env.DEMO_PASSWORD!

const { default: request } = await import('supertest')
const { createApp } = await import('../src/app.js')
const { prisma } = await import('../src/db.js')
const app = createApp()

const login = async (email: string) => {
  const r = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  return r.body.token as string
}
const as = (token: string) => ({
  get: (u: string) => request(app).get('/api/v1' + u).set('Authorization', `Bearer ${token}`),
  post: (u: string, b: object = {}) => request(app).post('/api/v1' + u).set('Authorization', `Bearer ${token}`).send(b),
  put: (u: string, b: object = {}) => request(app).put('/api/v1' + u).set('Authorization', `Bearer ${token}`).send(b),
})

let admin: ReturnType<typeof as>, vendeur: ReturnType<typeof as>, atlas: ReturnType<typeof as>

before(async () => {
  const env = { ...process.env, DATABASE_URL: TEST_DB }
  execSync('npx prisma db push --force-reset --accept-data-loss --skip-generate', { env, stdio: 'ignore' })
  execSync('npx tsx src/seed.ts', { env, stdio: 'ignore' })
  admin = as(await login('sallam@seve-para.ma'))
  vendeur = as(await login('hajar@seve-para.ma'))
  atlas = as(await login('sallam@atlas-para.ma'))
})
after(() => prisma.$disconnect())

describe('Authentification', () => {
  test('refuse un mauvais mot de passe', async () => {
    const r = await request(app).post('/api/v1/auth/login').send({ email: 'sallam@seve-para.ma', password: 'mauvais' })
    assert.equal(r.status, 401)
  })
  test('refuse les appels sans jeton', async () => {
    assert.equal((await request(app).get('/api/v1/bootstrap')).status, 401)
  })
})

describe('Permissions par rôle', () => {
  test('le vendeur ne reçoit pas les prix d’achat', async () => {
    const a = await admin.get('/bootstrap')
    const v = await vendeur.get('/bootstrap')
    assert.ok(a.body.data.products[0].purchasePrice > 0)
    assert.equal(v.body.data.products[0].purchasePrice, 0)
    assert.ok(v.body.data.orders.every((o: { items: { unitCost: number }[] }) => o.items.every((i) => i.unitCost === 0)))
  })
  test('le vendeur ne peut pas créer de produit ni accorder de remise', async () => {
    assert.equal((await vendeur.post('/products', {})).status, 403)
    const boot = await vendeur.get('/bootstrap')
    const store = boot.body.user.storeId
    const r = await vendeur.post('/pos/sales', { storeId: store, lines: [{ productId: 'p1', qty: 1 }], discount: 10, method: 'carte' })
    assert.equal(r.status, 403)
  })
  test('le vendeur ne peut encaisser que dans sa boutique', async () => {
    const r = await vendeur.post('/pos/sales', { storeId: 'st3', lines: [{ productId: 'p1', qty: 1 }], method: 'carte' })
    assert.equal(r.status, 403)
  })
})

describe('Isolation multi-tenant', () => {
  test('aucune donnée d’un autre tenant dans le snapshot', async () => {
    const s = await admin.get('/bootstrap')
    assert.ok(s.body.data.products.every((p: { id: string }) => !p.id.startsWith('at_')))
    assert.ok(s.body.data.orders.every((o: { id: string }) => !o.id.startsWith('at_')))
  })
  test('impossible de modifier ou lire une ressource d’un autre tenant', async () => {
    const atlasOrder = (await atlas.get('/bootstrap')).body.data.orders[0]
    assert.ok(atlasOrder)
    assert.equal((await admin.post(`/orders/${atlasOrder.id}/advance`)).status, 404)
    const atlasProduct = (await atlas.get('/bootstrap')).body.data.products[0]
    assert.equal((await admin.put(`/products/${atlasProduct.id}`, { ...atlasProduct, price: 1 })).status, 404)
    const still = await prisma.product.findUnique({ where: { id: atlasProduct.id } })
    assert.equal(Number(still!.price), atlasProduct.price)
  })
})

describe('Boutique publique', () => {
  test('le snapshot public ne contient ni coûts, ni lots, ni codes promo, ni clients', async () => {
    const r = await request(app).get('/api/v1/store/seve/bootstrap')
    assert.equal(r.status, 200)
    const d = r.body.data
    assert.ok(d.products.every((p: { purchasePrice: number }) => p.purchasePrice === 0))
    assert.equal(d.lots.length, 0)
    assert.equal(d.customers.length, 0)
    assert.equal(d.orders.length, 0)
    assert.ok(d.promotions.every((p: { code?: string }) => !p.code))
    assert.ok(Object.keys(d.insights.available).length > 0)
  })
  test('le plan Essentiel n’a pas de boutique en ligne', async () => {
    await prisma.tenant.update({ where: { id: 't_atlas' }, data: { plan: 'essentiel' } })
    assert.equal((await request(app).get('/api/v1/store/atlas/bootstrap')).status, 403)
    await prisma.tenant.update({ where: { id: 't_atlas' }, data: { plan: 'pro' } })
  })
})

describe('Commande en ligne → préparation → expédition (FEFO)', () => {
  const customer = { firstName: 'Test', lastName: 'Client', email: 'test.client@mail.ma', phone: '0612345678', address: '10 Rue du Test', city: 'Meknès' }
  let orderId = ''

  test('le serveur recalcule les montants et réserve le stock', async () => {
    const before = (await request(app).get('/api/v1/store/seve/bootstrap')).body.data.insights.available.p3
    const r = await request(app).post('/api/v1/store/seve/orders').send({ lines: [{ kind: 'product', productId: 'p3', qty: 2 }], customer, coupon: 'ECLAT50', mode: 'standard', method: 'carte', total: 1 })
    assert.equal(r.status, 201, JSON.stringify(r.body))
    const o = r.body.order
    orderId = o.id
    assert.equal(o.subtotal, 518) // 2 × 259, the client's "total: 1" is ignored
    assert.equal(o.discount, 50)
    assert.equal(o.total, 468)
    assert.equal(o.status, 'recue')
    const after = (await request(app).get('/api/v1/store/seve/bootstrap')).body.data.insights.available.p3
    assert.equal(after, before - 2)
  })

  test('un code promo invalide est refusé', async () => {
    const r = await request(app).post('/api/v1/store/seve/orders').send({ lines: [{ kind: 'product', productId: 'p3', qty: 1 }], customer, coupon: 'FAUX', mode: 'standard', method: 'carte' })
    assert.equal(r.status, 400)
  })

  test('une quantité supérieure au stock disponible est refusée', async () => {
    const r = await request(app).post('/api/v1/store/seve/orders').send({ lines: [{ kind: 'product', productId: 'p3', qty: 50 }], customer, mode: 'standard', method: 'carte' })
    assert.ok([400, 409].includes(r.status))
  })

  test('l’expédition consomme le lot qui expire en premier', async () => {
    const lotsBefore = await prisma.lot.findMany({ where: { tenantId: 't_seve', productId: 'p3', storeId: 'st1', qty: { gt: 0 } }, orderBy: { expiresAt: 'asc' } })
    assert.equal((await admin.post(`/orders/${orderId}/advance`)).status, 200)
    const r = await admin.post(`/orders/${orderId}/advance`)
    assert.equal(r.status, 200)
    assert.equal(r.body.changes.orders[0].status, 'expediee')
    const first = await prisma.lot.findUnique({ where: { id: lotsBefore[0].id } })
    assert.equal(first!.qty, Math.max(0, lotsBefore[0].qty - 2))
    assert.ok(r.body.changes.movements.length >= 1)
  })

  test('le client retrouve sa commande avec sa clé, pas sans', async () => {
    const r = await request(app).post('/api/v1/store/seve/orders').send({ lines: [{ kind: 'product', productId: 'p1', qty: 1 }], customer, mode: 'standard', method: 'livraison' })
    assert.equal((await request(app).get(`/api/v1/store/seve/orders/${r.body.order.id}`)).status, 404)
    assert.equal((await request(app).get(`/api/v1/store/seve/orders/${r.body.order.id}?key=${r.body.guestKey}`)).status, 200)
  })
})

describe('Caisse, retours et verrouillage du stock', () => {
  test('vente POS avec prix serveur puis retour limité à la quantité achetée', async () => {
    const sale = await admin.post('/pos/sales', { storeId: 'st1', lines: [{ productId: 'p1', qty: 2 }], method: 'especes' })
    assert.equal(sale.status, 201, JSON.stringify(sale.body))
    assert.equal(sale.body.result.total, 278)
    const ret = await admin.post('/pos/returns', { orderId: sale.body.result.id, items: [{ productId: 'p1', qty: 1 }], mode: 'remboursement' })
    assert.equal(ret.status, 201)
    const again = await admin.post('/pos/returns', { orderId: sale.body.result.id, items: [{ productId: 'p1', qty: 2 }], mode: 'remboursement' })
    assert.equal(again.status, 409)
  })

  test('deux ventes simultanées de la dernière unité : une seule réussit', async () => {
    assert.equal((await admin.post('/stock/inventory', { productId: 'p2', storeId: 'st2', counted: 1 })).status, 200)
    const [a, b] = await Promise.all([
      admin.post('/pos/sales', { storeId: 'st2', lines: [{ productId: 'p2', qty: 1 }], method: 'carte' }),
      admin.post('/pos/sales', { storeId: 'st2', lines: [{ productId: 'p2', qty: 1 }], method: 'carte' }),
    ])
    assert.deepEqual([a.status, b.status].sort(), [201, 409])
    const left = await prisma.lot.aggregate({ where: { tenantId: 't_seve', productId: 'p2', storeId: 'st2' }, _sum: { qty: true } })
    assert.equal(left._sum.qty, 0)
  })
})

describe('Achats', () => {
  test('la réception partielle crée un lot et laisse le bon ouvert', async () => {
    const po = await prisma.purchaseOrder.findFirst({ where: { tenantId: 't_seve', status: 'envoyee' } })
    const line = (po!.lines as { productId: string; qty: number }[])[0]
    const before = await prisma.lot.aggregate({ where: { tenantId: 't_seve', productId: line.productId, storeId: po!.storeId }, _sum: { qty: true } })
    const r = await admin.post(`/purchase-orders/${po!.id}/receive`, { receipts: [{ index: 0, qty: 3, lotNumber: 'LTEST', expiresAt: '2030-01-01' }] })
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.equal(r.body.changes.purchaseOrders[0].status, 'partielle')
    const afterSum = await prisma.lot.aggregate({ where: { tenantId: 't_seve', productId: line.productId, storeId: po!.storeId }, _sum: { qty: true } })
    assert.equal(afterSum._sum.qty, (before._sum.qty ?? 0) + 3)
  })
})

describe('SaaS', () => {
  test('inscription : nouvel espace isolé avec kit de démarrage', async () => {
    const r = await request(app).post('/api/v1/auth/signup').send({ pharmacyName: 'Para Test Oujda', city: 'Oujda', plan: 'pro', ownerName: 'Test Gérant', email: 'gerant@test-oujda.ma', password: 'MotDePasse123' })
    assert.equal(r.status, 201, JSON.stringify(r.body))
    const s = await as(r.body.token).get('/bootstrap')
    assert.equal(s.body.data.orders.length, 0)
    assert.equal(s.body.data.customers.length, 0)
    assert.equal(s.body.data.reviews.length, 0)
    assert.ok(s.body.data.products.length > 0)
    assert.ok(s.body.data.products.every((p: { id: string }) => p.id.startsWith(r.body.tenant.id)))
  })
  test('limite du plan : pas de 3e boutique en Pro', async () => {
    const r = await atlas.post('/stores', { name: 'Atlas 2', city: 'Rabat' })
    assert.equal(r.status, 201)
    assert.equal((await atlas.post('/stores', { name: 'Atlas 3', city: 'Fès' })).status, 403)
  })
  test('l’opérateur voit les abonnements mais pas les données métier', async () => {
    const op = as(await login(process.env.OPERATOR_EMAIL ?? 'operateur@paraflow.ma'))
    const r = await op.get('/operator/tenants')
    assert.equal(r.status, 200)
    assert.ok(r.body.length >= 3)
    assert.equal((await op.get('/bootstrap')).status, 401)
  })
})
