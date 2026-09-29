/** Use Vite's proxy locally and the deployed API in production. VITE_API_URL can override either. */
const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
const defaultApiUrl = import.meta.env.PROD
  ? 'https://parapharmacie-ssgh.onrender.com/api/v1'
  : '/api/v1'
export const API_BASE = (configuredApiUrl || defaultApiUrl).replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message) }
}

export async function api<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, token?: string | null): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    const message = import.meta.env.PROD
      ? 'API inaccessible depuis le site : vérifiez le CORS du backend (CORS_ORIGIN=* sur Render) et son URL.'
      : 'Serveur injoignable — vérifiez que l’API est démarrée (npm run dev dans server/).'
    throw new ApiError(0, message)
  }
  const text = await res.text()
  const json = text ? (() => { try { return JSON.parse(text) } catch { return null } })() : null
  if (!res.ok) {
    const details = json?.details
    const first = Array.isArray(details) && details[0]?.message ? ` : ${details[0].message}` : ''
    throw new ApiError(res.status, (json?.error ?? `Erreur ${res.status}`) + first, details)
  }
  return json as T
}
