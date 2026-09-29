import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Loader2 } from 'lucide-react'
import { actions } from '../../lib/store'
import { PLANS } from '../../data/plans'
import { money } from '../../lib/format'
import { Logo } from '../../components/Logo'
import { Field, cx } from '../../components/ui'
import type { PlanId } from '../../lib/types'

const CITIES = ['Casablanca', 'Rabat', 'Fès', 'Meknès', 'Marrakech', 'Tanger', 'Agadir', 'Oujda', 'Kénitra', 'Tétouan']

export default function Signup() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [plan, setPlan] = useState<PlanId>((params.get('plan') as PlanId) || 'pro')
  const [f, setF] = useState({ name: '', city: 'Casablanca', owner: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.name.trim() || !f.owner.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Merci de compléter tous les champs avec un email valide.')
    if (f.password.length < 8) return setErr('Le mot de passe doit contenir au moins 8 caractères.')
    setLoading(true); setErr('')
    actions.signup({ pharmacyName: f.name.trim(), city: f.city, plan, ownerName: f.owner.trim(), email: f.email, password: f.password })
      .then(() => nav('/admin'))
      .catch((e2: Error) => { setErr(e2.message); setLoading(false) })
  }
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="p-6 md:p-12 flex flex-col">
        <Link to="/"><Logo /></Link>
        <div className="flex-1 flex items-center">
          <form onSubmit={submit} className="w-full max-w-md mx-auto py-10 space-y-4">
            <h1 className="text-3xl md:text-4xl">Créez votre espace</h1>
            <p className="text-muted">14 jours d’essai gratuit, sans carte bancaire. Votre espace est isolé et prêt en quelques secondes.</p>
            <Field label="Nom de la parapharmacie"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Parapharmacie Les Jardins" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ville"><select className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Votre nom"><input className="input" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></Field>
            </div>
            <Field label="Email professionnel"><input type="email" autoComplete="username" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Mot de passe" hint="8 caractères minimum"><input type="password" autoComplete="new-password" className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
            <div>
              <span className="label">Plan</span>
              <div className="grid grid-cols-3 gap-2">
                {PLANS.map((p) => (
                  <button type="button" key={p.id} onClick={() => setPlan(p.id)} className={cx('rounded-xl border p-3 text-left cursor-pointer', plan === p.id ? 'border-sage-500 bg-sage-50 ring-4 ring-sage-100' : 'border-line')}>
                    <div className="text-sm font-medium">{p.name}</div><div className="text-xs text-muted">{money(p.price)}/mois</div>
                  </button>
                ))}
              </div>
            </div>
            {err && <p className="text-sm text-rose-ink">{err}</p>}
            <button className="btn-primary w-full h-12" disabled={loading}>{loading ? <><Loader2 className="size-4 animate-spin" /> Création de votre espace…</> : 'Démarrer mon essai gratuit'}</button>
            <p className="text-sm text-muted text-center">Déjà client ? <Link to="/connexion" className="text-sage-600 hover:underline">Se connecter</Link></p>
          </form>
        </div>
      </div>
      <div className="hidden lg:flex bg-gradient-to-br from-sage-100 via-cream to-champagne-100 p-12 items-center">
        <div className="max-w-md mx-auto">
          <h2 className="text-3xl">Ce que vous obtenez immédiatement</h2>
          <ul className="mt-8 space-y-4">
            {['Votre espace dédié, votre logo et vos couleurs', 'Un catalogue de démarrage à personnaliser ou importer (CSV)', 'Caisse POS, stock par lots et alertes d’expiration', 'Votre boutique en ligne prête à publier', 'CRM, fidélité et campagnes marketing', 'Aucune donnée partagée avec les autres parapharmacies'].map((x) => (
              <li key={x} className="flex gap-3"><span className="size-6 rounded-full bg-surface grid place-items-center shrink-0"><Check className="size-3.5 text-sage-600" /></span>{x}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
