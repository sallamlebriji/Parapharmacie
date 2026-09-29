import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message) }
}
export const badRequest = (m: string, details?: unknown) => new HttpError(400, m, details)
export const unauthorized = (m = 'Authentification requise') => new HttpError(401, m)
export const forbidden = (m = 'Action non autorisée pour votre rôle') => new HttpError(403, m)
export const notFound = (m = 'Ressource introuvable') => new HttpError(404, m)
export const conflict = (m: string) => new HttpError(409, m)

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>
/** Wraps async route handlers so rejected promises reach the error middleware. */
export const ah = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => { fn(req, res, next).catch(next) }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details })
  if (err instanceof ZodError) return res.status(400).json({ error: 'Données invalides', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) })
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Cette valeur existe déjà (doublon)', details: err.meta })
    if (err.code === 'P2025') return res.status(404).json({ error: 'Ressource introuvable' })
  }
  console.error(err)
  res.status(500).json({ error: 'Erreur interne du serveur' })
}
