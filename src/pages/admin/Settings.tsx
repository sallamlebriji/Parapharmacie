import { useState } from 'react'
import { Check, Code2, CreditCard, Smartphone } from 'lucide-react'
import { actions, useData, useTenant } from '../../lib/store'
import { PLANS } from '../../data/plans'
import { date, daysUntil, money } from '../../lib/format'
import { Badge, Card, Field, PageHeader, Progress, Tabs, Toggle, cx, toast } from '../../components/ui'
import type { AppNotification } from '../../lib/types'

const NOTIF_TYPES: { id: AppNotification['type']; label: string }[] = [
  { id: 'commande', label: 'Nouvelle commande' }, { id: 'paiement', label: 'Paiement confirmé' }, { id: 'expedition', label: 'Commande expédiée' },
  { id: 'stock', label: 'Stock faible' }, { id: 'expiration', label: 'Produit bientôt expiré' }, { id: 'client', label: 'Nouveau client' },
  { id: 'avis', label: 'Avis client' }, { id: 'retour_stock', label: 'Produit de nouveau disponible' },
]

export default function Settings() {
  const t = useTenant()
  const d = useData()
  const [tab, setTab] = useState<'general' | 'abonnement' | 'notifications' | 'integrations'>('general')
  const [cycle, setCycle] = useState<'mois' | 'an'>('mois')
  const [notifs, setNotifs] = useState(() => Object.fromEntries(NOTIF_TYPES.map((n) => [n.id, { app: true, email: n.id !== 'client', sms: n.id === 'commande' }])))
  const plan = PLANS.find((p) => p.id === t.plan)!
  const usage = [
    { label: 'Boutiques', used: d.stores.length, max: plan.limits.stores },
    { label: 'Utilisateurs', used: d.employees.filter((e) => e.active).length, max: plan.limits.users },
    { label: 'Produits', used: d.products.length, max: plan.limits.products },
  ]

  return (
    <div>
      <PageHeader title="Paramètres" subtitle={`Espace ${t.name} · identifiant ${t.slug}`} actions={<Tabs value={tab} onChange={setTab} tabs={[{ id: 'general', label: 'Général & marque' }, { id: 'abonnement', label: 'Abonnement' }, { id: 'notifications', label: 'Notifications' }, { id: 'integrations', label: 'API & mobile' }]} />} />

      {tab === 'general' && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card title="Identité de la marque" className="lg:col-span-2">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nom commercial"><input className="input" value={t.name} onChange={(e) => actions.updateTenant({ name: e.target.value })} /></Field>
              <Field label="Slogan"><input className="input" value={t.tagline} onChange={(e) => actions.updateTenant({ tagline: e.target.value })} /></Field>
              <Field label="Couleur principale">
                <div className="flex gap-2 items-center">
                  <input type="color" className="size-10 rounded-lg border border-line cursor-pointer" value={t.primaryColor} onChange={(e) => actions.updateTenant({ primaryColor: e.target.value })} />
                  {['#5f7d68', '#8a6f4d', '#6b7fa0', '#a0707a', '#3c5143'].map((c) => <button key={c} onClick={() => actions.updateTenant({ primaryColor: c })} className={cx('size-7 rounded-full border-2 cursor-pointer', t.primaryColor === c ? 'border-ink' : 'border-white')} style={{ background: c }} aria-label={c} />)}
                </div>
              </Field>
              <Field label="Domaine de la boutique" hint="Domaine personnalisé disponible dès le plan Pro"><input className="input" defaultValue={`${t.slug}.paraflow.ma`} /></Field>
              <Field label="TVA par défaut (%)"><input type="number" className="input" value={t.settings.vatRate} onChange={(e) => actions.updateTenant({ settings: { vatRate: +e.target.value } })} /></Field>
              <Field label="Devise"><input className="input" value="MAD — Dirham marocain" readOnly /></Field>
            </div>
          </Card>
          <Card title="Aperçu">
            <div className="rounded-2xl border border-line overflow-hidden">
              <div className="h-16 flex items-center px-4 text-white" style={{ background: t.primaryColor }}><span className="font-display text-lg">{t.name}</span></div>
              <div className="p-4 text-sm text-muted">{t.tagline}<div className="mt-3"><span className="btn btn-sm text-white pointer-events-none" style={{ background: t.primaryColor }}>Ajouter au panier</span></div></div>
            </div>
            <p className="text-xs text-muted mt-3">Logo, couleurs et nom sont appliqués à la boutique en ligne, aux emails et aux tickets de caisse de cet espace uniquement.</p>
          </Card>
        </div>
      )}

      {tab === 'abonnement' && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm text-muted">Plan actuel</div>
                <div className="font-display text-2xl">{plan.name} <Badge tone={t.status === 'essai' ? 'amber' : 'sage'} dot>{t.status === 'essai' ? `Essai gratuit — ${Math.max(0, daysUntil(t.trialEndsAt))} j restants` : 'Actif'}</Badge></div>
                <div className="text-sm text-muted mt-1">{money(plan.price)} / mois · prochaine facture le {date(new Date(Date.now() + 12 * 864e5))}</div>
              </div>
              <div className="grid grid-cols-3 gap-6 min-w-72">
                {usage.map((u) => (
                  <div key={u.label}><div className="text-xs text-muted">{u.label}</div><div className="text-sm font-medium tabular-nums">{u.used} / {u.max.toLocaleString('fr-FR')}</div><Progress className="mt-1.5" value={(u.used / u.max) * 100} tone={u.used / u.max > 0.85 ? 'amber' : 'sage'} /></div>
                ))}
              </div>
            </div>
          </Card>
          <div className="flex justify-center"><Tabs value={cycle} onChange={setCycle} tabs={[{ id: 'mois', label: 'Mensuel' }, { id: 'an', label: 'Annuel — 2 mois offerts' }]} /></div>
          <div className="grid md:grid-cols-3 gap-4">
            {PLANS.map((p) => (
              <div key={p.id} className={cx('card p-6 flex flex-col', p.id === t.plan && 'ring-2 ring-sage-500')}>
                <div className="font-display text-xl">{p.name}</div>
                <p className="text-sm text-muted mt-1 min-h-10">{p.description}</p>
                <div className="mt-4"><span className="text-3xl font-semibold">{money(cycle === 'mois' ? p.price : p.yearly)}</span><span className="text-sm text-muted"> / {cycle === 'mois' ? 'mois' : 'an'} HT</span></div>
                <ul className="mt-4 space-y-2 text-sm flex-1">
                  <li className="text-muted">{p.limits.stores} boutique(s) · {p.limits.users} utilisateurs · {p.limits.products.toLocaleString('fr-FR')} produits</li>
                  {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="size-4 text-sage-500 shrink-0 mt-0.5" />{f}</li>)}
                </ul>
                <button className={cx('mt-5', p.id === t.plan ? 'btn-secondary' : 'btn-primary')} disabled={p.id === t.plan} onClick={() => { actions.changePlan(p.id).then(() => toast(`Plan ${p.name} activé`)).catch(() => {}) }}>{p.id === t.plan ? 'Plan actuel' : `Passer au plan ${p.name}`}</button>
              </div>
            ))}
          </div>
          <Card title={<span className="flex items-center gap-2"><CreditCard className="size-4" /> Factures Paraflow</span>} padded={false}>
            <table className="table-base">
              <thead><tr><th>Facture</th><th>Période</th><th className="text-right">Montant TTC</th><th>Statut</th></tr></thead>
              <tbody>{[0, 1, 2, 3].map((i) => { const dt = new Date(); dt.setMonth(dt.getMonth() - i); return (
                <tr key={i}><td className="font-mono text-xs">PF-{dt.getFullYear()}{String(dt.getMonth() + 1).padStart(2, '0')}-{t.slug.slice(0, 4).toUpperCase()}</td><td>{dt.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</td><td className="text-right tabular-nums">{money(plan.price * 1.2)}</td><td><Badge tone="sage" dot>Payée</Badge></td></tr>
              ) })}</tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'notifications' && (
        <Card padded={false}>
          <table className="table-base">
            <thead><tr><th>Événement</th><th className="text-center">Application</th><th className="text-center">Email</th><th className="text-center">SMS</th></tr></thead>
            <tbody>{NOTIF_TYPES.map((n) => (
              <tr key={n.id}>
                <td>{n.label}</td>
                {(['app', 'email', 'sms'] as const).map((ch) => <td key={ch} className="text-center"><div className="inline-flex"><Toggle on={notifs[n.id][ch]} onChange={(v) => setNotifs({ ...notifs, [n.id]: { ...notifs[n.id], [ch]: v } })} label={`${n.label} ${ch}`} /></div></td>)}
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}

      {tab === 'integrations' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title={<span className="flex items-center gap-2"><Code2 className="size-4" /> API REST</span>}>
            <p className="text-sm text-muted">Toutes les fonctionnalités de l’interface sont exposées via une API versionnée (<code className="text-xs bg-cream px-1 rounded">/api/v1</code>), scopée par tenant. {plan.limits.api ? '' : 'Disponible avec le plan Réseau.'}</p>
            <div className="mt-4 rounded-xl bg-sage-900 text-sage-100 p-4 font-mono text-xs overflow-x-auto">
              <div className="text-sage-300"># Lister les produits sous le seuil</div>
              <div>GET /api/v1/products?stock=low</div>
              <div>Authorization: Bearer pk_live_••••••••</div>
              <div>X-Tenant: {t.slug}</div>
            </div>
            <button className="btn-secondary mt-4" disabled={!plan.limits.api} onClick={() => toast('Clé API générée (affichée une seule fois)')}>Générer une clé API</button>
          </Card>
          <Card title={<span className="flex items-center gap-2"><Smartphone className="size-4" /> Applications mobiles</span>}>
            <p className="text-sm text-muted">Les applications consomment la même API que le web.</p>
            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div className="rounded-xl border border-line p-3"><div className="font-medium">App client</div><ul className="text-xs text-muted mt-1 space-y-0.5"><li>Catalogue & favoris</li><li>Commandes & livraison</li><li>Carte fidélité</li><li>Notifications push</li></ul></div>
              <div className="rounded-xl border border-line p-3"><div className="font-medium">App employé</div><ul className="text-xs text-muted mt-1 space-y-0.5"><li>POS mobile</li><li>Stock & inventaire</li><li>Scanner code-barres</li><li>Préparation commandes</li></ul></div>
            </div>
            <Badge tone="gold" className="mt-4">Feuille de route</Badge>
          </Card>
        </div>
      )}
    </div>
  )
}
