import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown, Gift, LogOut, Package } from 'lucide-react'
import { actions, getState, useData, useShopCustomer, useTenant } from '../../lib/store'
import { api } from '../../lib/api'
import { date, money } from '../../lib/format'
import { TIERS } from '../../lib/logic'
import { REWARDS } from '../../data/plans'
import { Badge, Empty, Field, Modal, ORDER_STATUS, Progress, StatusBadge, cx, toast } from '../../components/ui'
import { ProductCard } from '../../components/ProductCard'

export default function Account() {
  const d = useData()
  const t = useTenant()
  const me = useShopCustomer()
  const [code, setCode] = useState<string | null>(null)

  if (!me) return <AuthForms />
  const { customer: c, stats: s } = me
  const favs = c.favorites.map((id) => d.products.find((p) => p.id === id)!).filter(Boolean)
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="text-sm text-muted">Bonjour,</div><h1 className="text-3xl md:text-4xl">{c.firstName} {c.lastName}</h1></div>
        <button className="btn-ghost" onClick={() => void actions.shopLogout()}><LogOut className="size-4" /> Déconnexion</button>
      </div>
      <div className="grid lg:grid-cols-3 gap-5 mt-8">
        <div className="lg:col-span-2 rounded-[2rem] p-7 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${t.primaryColor}, #2f4035)` }}>
          <div className="absolute -right-12 -top-12 size-56 rounded-full bg-white/10" />
          <div className="relative flex justify-between">
            <div><div className="text-xs uppercase tracking-[0.16em] text-white/70">Carte fidélité {t.name}</div><div className="font-display text-3xl mt-2 flex items-center gap-2"><Crown className="size-6 text-champagne-200" /> {s.tier.id}</div></div>
            <div className="text-right"><div className="text-4xl font-semibold tabular-nums">{c.points}</div><div className="text-xs text-white/70">points · {money(c.points * t.settings.pointValue)}</div></div>
          </div>
          {s.next ? (
            <div className="relative mt-8">
              <div className="flex justify-between text-xs text-white/80 mb-2"><span>{money(s.spent12)} dépensés sur 12 mois</span><span>{s.next.id} à {money(s.next.min)}</span></div>
              <div className="h-2 rounded-full bg-white/20"><div className="h-full rounded-full bg-champagne-200" style={{ width: `${Math.min(100, (s.spent12 / s.next.min) * 100)}%` }} /></div>
            </div>
          ) : <div className="relative mt-8 text-sm text-white/80">Vous profitez du niveau le plus élevé. Merci pour votre fidélité ✨</div>}
          <div className="relative flex flex-wrap gap-2 mt-6">{s.tier.perks.map((p) => <span key={p} className="chip bg-white/15 text-white">{p}</span>)}</div>
        </div>
        <div className="card p-6">
          <div className="font-medium flex items-center gap-2"><Gift className="size-4 text-champagne-400" /> Mes récompenses</div>
          <ul className="mt-4 space-y-2">
            {REWARDS.map((r) => (
              <li key={r.cost} className="flex items-center gap-3">
                <div className="flex-1"><div className="text-sm">{r.label}</div><Progress className="mt-1" value={(c.points / r.cost) * 100} tone="gold" /></div>
                <button className={cx('btn-sm', c.points >= r.cost ? 'btn-gold' : 'btn-secondary')} disabled={c.points < r.cost} onClick={() => { actions.redeemReward(c.id, r.cost).then(setCode).catch(() => {}) }}>{r.cost} pts</button>
              </li>
            ))}
          </ul>
          <div className="text-[11px] text-muted mt-4">Niveaux : {TIERS.map((x) => x.id).join(' → ')}</div>
        </div>
      </div>
      <section className="mt-10">
        <h2 className="text-2xl mb-4">Mes commandes</h2>
        {s.orders.length === 0 ? <Empty icon={<Package className="size-5" />} title="Aucune commande" /> : (
          <div className="card divide-y divide-line">
            {s.orders.slice(0, 8).map((o) => (
              <Link key={o.id} to={o.channel === 'web' ? `/boutique/suivi/${o.id}` : '#'} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-ivory">
                <div className="flex-1 min-w-40"><div className="font-medium">{o.number}</div><div className="text-xs text-muted">{date(o.createdAt)} · {o.items.reduce((a, i) => a + i.qty, 0)} article(s) · {o.channel === 'web' ? 'En ligne' : 'En boutique'}</div></div>
                <StatusBadge map={ORDER_STATUS} value={o.status} />
                <div className="w-24 text-right font-medium tabular-nums">{money(o.total)}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="mt-10">
        <h2 className="text-2xl mb-4">Mes produits favoris</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{favs.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        {c.couponsUsed.length > 0 && <div className="mt-6 text-sm text-muted">Coupons utilisés : {c.couponsUsed.map((x, i) => <Badge key={i} tone="gold" className="ml-1">{x}</Badge>)}</div>}
      </section>
      <Modal open={!!code} onClose={() => setCode(null)} title="Votre bon d’achat 🎁">
        <p className="text-sm text-muted">Utilisez ce code au moment du paiement, en ligne ou en boutique. Valable 60 jours.</p>
        <div className="mt-4 text-center font-mono text-2xl tracking-widest rounded-2xl border-2 border-dashed border-champagne-400 bg-champagne-100/50 py-5">{code}</div>
        <button className="btn-primary w-full mt-4" onClick={() => { actions.setCoupon(code!); setCode(null); toast('Code appliqué à votre panier') }}>Appliquer à mon panier</button>
      </Modal>
    </div>
  )
}

const demoPassword = import.meta.env.VITE_DEMO_PASSWORD as string | undefined

function AuthForms() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', marketingOptIn: true })
  const [busy, setBusy] = useState(false)
  const [demo, setDemo] = useState<{ email: string; firstName: string; lastName: string }[]>([])
  useEffect(() => {
    // Development-only endpoint listing seeded demo customers.
    api<typeof demo>('GET', `/store/${getState().shopSlug}/demo-accounts`).then(setDemo).catch(() => {})
  }, [])
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'login') await actions.shopLogin(f.email, f.password)
      else await actions.shopRegister(f)
      toast('Bienvenue !')
    } catch { /* toast shown */ } finally { setBusy(false) }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === 'marketingOptIn' ? e.target.checked : e.target.value })
  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <form onSubmit={submit} className="card p-8 space-y-4">
        <h1 className="text-3xl text-center">{mode === 'login' ? 'Mon compte' : 'Créer un compte'}</h1>
        <p className="text-sm text-muted text-center">Suivez vos commandes, cumulez vos points fidélité et retrouvez vos favoris.</p>
        {mode === 'register' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom"><input className="input" autoComplete="given-name" value={f.firstName} onChange={set('firstName')} required /></Field>
            <Field label="Nom"><input className="input" autoComplete="family-name" value={f.lastName} onChange={set('lastName')} required /></Field>
          </div>
        )}
        <Field label="Email"><input type="email" className="input" autoComplete="username" value={f.email} onChange={set('email')} required /></Field>
        {mode === 'register' && <Field label="Téléphone"><input type="tel" className="input" autoComplete="tel" value={f.phone} onChange={set('phone')} placeholder="06 12 34 56 78" required /></Field>}
        <Field label="Mot de passe" hint={mode === 'register' ? '8 caractères minimum' : undefined}><input type="password" className="input" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} required /></Field>
        {mode === 'register' && <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={f.marketingOptIn} onChange={set('marketingOptIn')} /> Recevoir nos conseils et offres</label>}
        <button className="btn-primary w-full h-11" disabled={busy}>{mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</button>
        <button type="button" className="btn-ghost w-full" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Pas encore de compte ? Inscrivez-vous' : 'Déjà client ? Connectez-vous'}</button>
        {mode === 'login' && demo.length > 0 && (
          <div className="border-t border-line pt-4">
            <div className="text-[11px] uppercase tracking-wider text-soft mb-2">Comptes clients de démonstration</div>
            {demo.map((c) => (
              <button type="button" key={c.email} className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-cream cursor-pointer" onClick={() => setF({ ...f, email: c.email, password: demoPassword ?? f.password })}>
                {c.firstName} {c.lastName} <span className="text-xs text-muted">· {c.email}</span>
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  )
}
