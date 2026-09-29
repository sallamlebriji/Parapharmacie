import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Loader2, Lock } from 'lucide-react'
import { actions, useApp } from '../../lib/store'
import { Logo } from '../../components/Logo'
import { Field, cx } from '../../components/ui'

// Accounts created by `npm run db:seed` (server). The password is DEMO_PASSWORD from server/.env,
// mirrored for local development in .env.development.local (VITE_DEMO_PASSWORD).
const DEMO = [
  { email: 'sallam@seve-para.ma', label: 'Administrateur', sub: 'Parapharmacie Sève · 3 boutiques' },
  { email: 'nadia@seve-para.ma', label: 'Manager', sub: 'Sève Meknès' },
  { email: 'hajar@seve-para.ma', label: 'Vendeur', sub: 'Caisse, sans prix d’achat' },
  { email: 'mehdi@seve-para.ma', label: 'Gestionnaire stock', sub: 'Stock, lots, achats' },
  { email: 'aya@seve-para.ma', label: 'Préparateur', sub: 'Commandes uniquement' },
  { email: 'sallam@atlas-para.ma', label: 'Administrateur', sub: 'Parapharmacie Atlas (autre tenant)' },
  { email: 'operateur@paraflow.ma', label: 'Opérateur SaaS', sub: 'Console des abonnements' },
]
const demoPassword = import.meta.env.VITE_DEMO_PASSWORD as string | undefined

export default function Login() {
  const nav = useNavigate()
  const token = useApp((s) => s.token)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  if (token) return <Navigate to="/admin" replace />

  const submit = async (e?: React.FormEvent, creds?: { email: string; password: string }) => {
    e?.preventDefault()
    const c = creds ?? { email, password }
    setLoading(true); setError('')
    try {
      const kind = await actions.login(c.email, c.password)
      nav(kind === 'operator' ? '/console' : '/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ivory">
      <div className="p-6 md:p-12 flex flex-col">
        <Link to="/"><Logo /></Link>
        <div className="flex-1 flex items-center">
          <form onSubmit={submit} className="w-full max-w-sm mx-auto py-10 space-y-4">
            <h1 className="text-3xl md:text-4xl">Connexion</h1>
            <p className="text-muted text-sm">Accédez à l’espace de gestion de votre parapharmacie.</p>
            <Field label="Email professionnel"><input type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            <Field label="Mot de passe"><input type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
            {error && <p className="text-sm text-rose-ink" role="alert">{error}</p>}
            <button className="btn-primary w-full h-11" disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />} Se connecter</button>
            <p className="text-sm text-muted text-center">Pas encore client ? <Link to="/inscription" className="text-sage-600 hover:underline">Essai gratuit de 14 jours</Link></p>
          </form>
        </div>
      </div>
      <div className="bg-gradient-to-br from-sage-100 via-cream to-champagne-100 p-6 md:p-12 flex items-center">
        <div className="w-full max-w-md mx-auto">
          <div className="text-[11px] uppercase tracking-[0.16em] text-champagne-600">Environnement de démonstration</div>
          <h2 className="text-2xl mt-2">Comptes de test</h2>
          <p className="text-sm text-muted mt-1">Chaque rôle voit une interface et des permissions différentes, appliquées par le serveur.</p>
          <ul className="mt-5 space-y-2">
            {DEMO.map((a) => (
              <li key={a.email}>
                <button type="button" disabled={loading} onClick={() => (demoPassword ? submit(undefined, { email: a.email, password: demoPassword }) : setEmail(a.email))} className={cx('w-full text-left card px-4 py-3 flex items-center gap-3 cursor-pointer transition hover:shadow-lift hover:border-sage-300')}>
                  <span className="flex-1"><span className="block text-sm font-medium">{a.label}</span><span className="block text-[11px] text-muted">{a.sub} · {a.email}</span></span>
                  <span className="text-xs text-sage-600">{demoPassword ? 'Se connecter →' : 'Remplir'}</span>
                </button>
              </li>
            ))}
          </ul>
          {!demoPassword && <p className="text-xs text-muted mt-3">Mot de passe : Password</p>}
        </div>
      </div>
    </div>
  )
}
