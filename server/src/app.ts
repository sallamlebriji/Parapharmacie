import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { config } from './config.js'
import { errorHandler, notFound } from './errors.js'
import { prisma } from './db.js'
import { authRouter } from './routes/auth.js'
import { staffRouter } from './routes/staff.js'
import { storeRouter } from './routes/store.js'
import { operatorRouter } from './routes/operator.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({ origin: config.corsOrigins, credentials: false }))
  app.use(compression())
  app.use(express.json({ limit: '2mb' }))

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      res.json({ ok: true, db: 'mysql', time: new Date().toISOString() })
    } catch (e) {
      // Report the database problem instead of letting the rejection crash the process.
      res.status(503).json({ ok: false, error: e instanceof Error ? e.message.split('\n').filter(Boolean).pop() : 'Base de données indisponible' })
    }
  })

  const v1 = express.Router()
  v1.use('/auth', authRouter)
  v1.use('/operator', operatorRouter)
  v1.use('/store/:slug', storeRouter)
  v1.use('/', staffRouter)
  app.use('/api/v1', v1)

  app.use('/api', (_req, _res, next) => next(notFound('Route API inconnue')))
  app.use(errorHandler)
  return app
}
