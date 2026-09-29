import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { seedTenant } from '../../../src/data/seed.js'
import { slugify } from '../../../src/lib/format.js'
import type { Tenant } from '../../../src/lib/types.js'
import { checkPassword, hashPassword, requireStaff, sign } from '../auth.js'
import { prisma } from '../db.js'
import { ah, conflict, unauthorized } from '../errors.js'
import { insertTenant } from '../domain/importer.js'
import { toTenant } from '../mappers.js'

export const authRouter = Router()

const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Trop de tentatives, réessayez dans quelques minutes.' } })

const staffUser = (u: { id: string; name: string; email: string; role: string; storeId: string | null }) => ({ id: u.id, name: u.name, email: u.email, role: u.role, storeId: u.storeId })

authRouter.post('/login', limiter, ah(async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body)
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user || !(await checkPassword(password, user.passwordHash))) throw unauthorized('Email ou mot de passe incorrect')
  if (!user.active) throw unauthorized('Ce compte est désactivé')
  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })
  if (user.isOperator) return res.json({ kind: 'operator', token: sign({ kind: 'operator', sub: user.id }), user: staffUser(user) })
  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId! } })
  res.json({ kind: 'staff', token: sign({ kind: 'staff', sub: user.id, tid: user.tenantId! }), user: staffUser(user), tenant: tenant && toTenant(tenant) })
}))

authRouter.get('/me', requireStaff, ah(async (req, res) => {
  const s = req.staff!
  const u = await prisma.user.findUnique({ where: { id: s.userId } })
  res.json({ user: staffUser(u!), tenant: s.tenant })
}))

const signupSchema = z.object({
  pharmacyName: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(80),
  plan: z.enum(['essentiel', 'pro', 'reseau']),
  ownerName: z.string().trim().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
})

/**
 * Free trial: creates an isolated tenant with a starter kit (reference catalogue, suppliers,
 * delivery zones, routines, articles) — no sales, customers or reviews — and its admin account.
 */
authRouter.post('/signup', limiter, ah(async (req, res) => {
  const input = signupSchema.parse(req.body)
  const email = input.email.toLowerCase()
  if (await prisma.user.findUnique({ where: { email } })) throw conflict('Un compte existe déjà avec cet email')

  const tid = `t_${randomBytes(5).toString('hex')}`
  let slug = slugify(input.pharmacyName) || tid
  if (await prisma.tenant.findUnique({ where: { slug } })) slug = `${slug}-${randomBytes(2).toString('hex')}`
  const data = seedTenant({ seed: Math.floor(Math.random() * 1e6), prefix: `${tid}_`, ordersPerDay: 0, customers: 0, stores: [{ name: input.pharmacyName, city: input.city, address: 'Adresse à compléter', phone: '', manager: input.ownerName, openedAt: new Date().toISOString().slice(0, 10) }] })
  const owner = { id: `${tid}_owner`, name: input.ownerName, email, role: 'admin' as const, storeId: data.stores[0].id, active: true, lastLogin: new Date().toISOString() }
  // Starter kit only: no fabricated activity, customers or reviews for a real new pharmacy.
  Object.assign(data, { employees: [owner], reviews: [], campaigns: [], expenses: [], chats: [], analytics: [], orders: [], customers: [] })
  data.products.forEach((p) => { p.rating = 0; p.reviewsCount = 0 })
  data.notifications = [{ id: `${tid}_n1`, type: 'client', title: 'Bienvenue sur Paraflow 🎉', body: 'Votre essai gratuit de 14 jours a commencé. Importez votre catalogue pour démarrer.', date: new Date().toISOString(), read: false, link: '/admin/produits' }]

  const tenant: Tenant = {
    id: tid, name: input.pharmacyName, slug, tagline: 'Votre parapharmacie en ligne', primaryColor: '#5f7d68', plan: input.plan, status: 'essai',
    trialEndsAt: new Date(Date.now() + 14 * 864e5).toISOString(), createdAt: new Date().toISOString(),
    settings: { currency: 'MAD', pointsPerDh: 0.1, pointValue: 0.5, vatRate: 20, lowStockDefault: 8 },
  }
  const hash = await hashPassword(input.password)
  await prisma.$transaction((tx) => insertTenant(tenant, data, { staffPasswordHash: hash }, tx), { timeout: 30_000 })
  res.status(201).json({ kind: 'staff', token: sign({ kind: 'staff', sub: owner.id, tid }), user: { id: owner.id, name: owner.name, email, role: 'admin', storeId: owner.storeId }, tenant })
}))
