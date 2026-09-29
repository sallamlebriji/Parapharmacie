import type { NextFunction, Request, Response } from 'express'
import jwt, { type SignOptions } from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { config } from './config.js'
import { prisma, tenantDb, type TenantDb } from './db.js'
import { forbidden, unauthorized } from './errors.js'
import type { Permission, Role, Tenant } from '../../src/lib/types.js'
import { toTenant } from './mappers.js'

type Claims =
  | { kind: 'staff'; sub: string; tid: string }
  | { kind: 'customer'; sub: string; tid: string }
  | { kind: 'operator'; sub: string }

export const sign = (claims: Claims) => jwt.sign(claims, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as SignOptions)
export const hashPassword = (p: string) => bcrypt.hash(p, 10)
export const checkPassword = (p: string, hash: string) => bcrypt.compare(p, hash)

function readToken(req: Request): Claims | null {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) return null
  try { return jwt.verify(h.slice(7), config.jwtSecret) as Claims } catch { return null }
}

export interface StaffContext {
  userId: string
  userName: string
  role: Role
  storeId: string | null
  tenant: Tenant
  perms: Permission[]
  db: TenantDb
  can: (p: Permission) => boolean
}

declare module 'express-serve-static-core' {
  interface Request { staff?: StaffContext; customer?: { id: string; tenantId: string } }
}

/** Authenticates an employee, loads the tenant and its role permissions, and scopes the DB client. */
export async function requireStaff(req: Request, _res: Response, next: NextFunction) {
  try {
    const c = readToken(req)
    if (!c || c.kind !== 'staff') throw unauthorized()
    const user = await prisma.user.findUnique({ where: { id: c.sub } })
    if (!user || !user.active || user.tenantId !== c.tid) throw unauthorized('Session expirée ou compte désactivé')
    const t = await prisma.tenant.findUnique({ where: { id: c.tid } })
    if (!t) throw unauthorized()
    if (t.status === 'suspendu') throw forbidden('Espace suspendu — contactez le support Paraflow')
    const tenant = toTenant(t)
    const perms = ((t.permissions as Record<string, Permission[]>)[user.role] ?? []) as Permission[]
    req.staff = { userId: user.id, userName: user.name, role: user.role as Role, storeId: user.storeId, tenant, perms, db: tenantDb(t.id), can: (p) => perms.includes(p) }
    next()
  } catch (e) { next(e) }
}

export const requirePerm = (...any: Permission[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.staff) return next(unauthorized())
  if (!any.some((p) => req.staff!.can(p))) return next(forbidden())
  next()
}

export function requireOperator(req: Request, _res: Response, next: NextFunction) {
  const c = readToken(req)
  if (!c || c.kind !== 'operator') return next(unauthorized('Accès réservé à l’opérateur de la plateforme'))
  next()
}

/** Optional customer session on storefront routes (must belong to the storefront's tenant). */
export function readCustomer(req: Request, tenantId: string) {
  const c = readToken(req)
  if (c?.kind === 'customer' && c.tid === tenantId) return c.sub
  return null
}
