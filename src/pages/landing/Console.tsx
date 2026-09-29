import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Database, LogOut, ShieldCheck } from 'lucide-react'
import { actions, useApp } from '../../lib/store'
import { api } from '../../lib/api'
import { PLANS } from '../../data/plans'
import { date, daysUntil, money } from '../../lib/format'
import { Logo } from '../../components/Logo'
import { Badge, Card, Empty, PageHeader, Stat } from '../../components/ui'
import type { Tenant } from '../../lib/types'

type Row = Tenant & { usage: { stores: number; users: number; products: number } }

/** Paraflow operator console: the SaaS provider's view over all tenants (billing & usage only). */
export default function Console() {
  const token = useApp((s) => s.operatorToken)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!token) return
    api<Row[]>('GET', '/operator/tenants', undefined, token).then(setRows).catch((e) => { setError(e.message); if (e.status === 401) actions.logoutOperator() })
  }, [token])
  if (!token) return <Navigate to="/connexion" replace />

  const plan = (id: string) => PLANS.find((p) => p.id === id)!
  const list = rows ?? []
  const paying = list.filter((t) => t.status === 'actif')
  const mrr = paying.reduce((a, t) => a + plan(t.plan).price, 0)
  return (
    <div className="min-h-screen bg-ivory">
      <header className="h-16 border-b border-line bg-white"><div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between"><Link to="/"><Logo sub="Console opérateur" /></Link><button className="btn-ghost btn-sm" onClick={() => actions.logoutOperator()}><LogOut className="size-3.5" /> Déconnexion</button></div></header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <PageHeader title="Tenants & abonnements" subtitle="Vue fournisseur SaaS : facturation et consommation uniquement — les données métier des parapharmacies ne sont pas accessibles ici." />
        {error && <p className="text-sm text-rose-ink mb-4">{error}</p>}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Stat label="Tenants" value={list.length} />
          <Stat label="Abonnés payants" value={paying.length} tone="sky" />
          <Stat label="En essai gratuit" value={list.filter((t) => t.status === 'essai').length} tone="amber" />
          <Stat label="MRR" value={money(mrr)} tone="gold" hint={`ARR ${money(mrr * 12)}`} />
        </div>
        <Card padded={false}>
          {!rows ? <Empty title="Chargement…" /> : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead><tr><th>Tenant</th><th>Boutique en ligne</th><th>Plan</th><th>Statut</th><th>Boutiques</th><th>Utilisateurs</th><th>Produits</th><th>Créé le</th></tr></thead>
                <tbody>
                  {list.map((t) => {
                    const p = plan(t.plan)
                    return (
                      <tr key={t.id}>
                        <td><div className="flex items-center gap-2"><span className="size-7 rounded-md grid place-items-center text-white text-xs" style={{ background: t.primaryColor }}>{t.name.split(' ').pop()![0]}</span><div><div className="font-medium">{t.name}</div><div className="text-[11px] text-muted font-mono">{t.id}</div></div></div></td>
                        <td>{p.limits.ecommerce ? <Link className="text-sage-600 hover:underline text-xs" to={`/boutique?boutique=${t.slug}`} target="_blank">/{t.slug}</Link> : <span className="text-xs text-soft">non incluse</span>}</td>
                        <td>{p.name} <span className="text-xs text-muted">{money(p.price)}/mois</span></td>
                        <td>{t.status === 'essai' ? <Badge tone="amber" dot>Essai · J-{Math.max(0, daysUntil(t.trialEndsAt))}</Badge> : <Badge tone="sage" dot>Actif</Badge>}</td>
                        <td className="tabular-nums">{t.usage.stores} / {p.limits.stores}</td>
                        <td className="tabular-nums">{t.usage.users} / {p.limits.users}</td>
                        <td className="tabular-nums">{t.usage.products}</td>
                        <td className="text-muted">{date(t.createdAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <Card title={<span className="flex items-center gap-2"><ShieldCheck className="size-4 text-sage-500" /> Isolation des données</span>}><p className="text-sm text-muted">Chaque table métier MySQL porte une colonne <code className="text-xs bg-cream px-1 rounded">tenantId</code>. Le serveur injecte ce filtre dans toutes les requêtes des routes authentifiées : un employé ne peut ni lire ni modifier les données d’une autre parapharmacie.</p></Card>
          <Card title={<span className="flex items-center gap-2"><Database className="size-4 text-sage-500" /> Limites par plan</span>}><p className="text-sm text-muted">Boutiques, utilisateurs, produits et modules (e-commerce, marketing, API) sont vérifiés côté serveur à chaque création.</p></Card>
        </div>
      </main>
    </div>
  )
}
