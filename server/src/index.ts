import { createApp } from './app.js'
import { config } from './config.js'
import { prisma } from './db.js'

const app = createApp()
const server = app.listen(config.port, () => console.log(`API Paraflow → http://localhost:${config.port}/api/v1 (MySQL)`))

async function shutdown() {
  server.close()
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
