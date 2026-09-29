import 'dotenv/config'

function required(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Variable d'environnement manquante : ${name} (voir server/.env.example)`)
  return v
}

export const config = {
  port: Number(process.env.PORT ?? 4100),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  // Bearer-token API (no cookies): wildcard is a safe default for tenant storefronts
  // hosted on customer domains. Set CORS_ORIGIN to a comma-separated allowlist if desired.
  corsOrigins: (process.env.CORS_ORIGIN ?? (process.env.NODE_ENV === 'production' ? '*' : 'http://localhost:5173'))
    .split(',').map((s) => s.trim()).filter(Boolean),
  demoPassword: process.env.DEMO_PASSWORD ?? '',
  operatorEmail: process.env.OPERATOR_EMAIL ?? 'operateur@paraflow.ma',
  isProd: process.env.NODE_ENV === 'production',
}
