import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Search } from 'lucide-react'
import { useData } from '../../lib/store'
import { date, download, money, toCSV } from '../../lib/format'
import { customerStats, SEGMENTS, type Segment } from '../../lib/logic'
import { Avatar, Badge, Card, PageHeader, Stat, Tabs } from '../../components/ui'

export default function Customers() {
  const d = useData()
  const nav = useNavigate()
  const [seg, setSeg] = useState<Segment | ''>('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'spent' | 'last' | 'created'>('spent')
  const rows = useMemo(() => d.customers.map((c) => ({ c, s: customerStats(d, c) })), [d])
  const list = rows
    .filter((r) => (!seg || r.s.segment === seg) && (!q || `${r.c.firstName} ${r.c.lastName} ${r.c.phone} ${r.c.email} ${r.c.city}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => sort === 'spent' ? b.s.spent - a.s.spent : sort === 'last' ? (b.s.last ?? '').localeCompare(a.s.last ?? '') : b.c.createdAt.localeCompare(a.c.createdAt))
  const count = (s: Segment) => rows.filter((r) => r.s.segment === s).length
  const active = rows.filter((r) => r.s.count > 0)
  const repeat = active.filter((r) => r.s.count > 1).length

  return (
    <div>
      <PageHeader title="Clients" subtitle="CRM intégré : historique, valeur client, fidélité et segmentation automatique." actions={
        <button className="btn-secondary" onClick={() => download('clients.csv', toCSV(list.map(({ c, s }) => ({ nom: c.lastName, prenom: c.firstName, telephone: c.phone, email: c.email, ville: c.city, commandes: s.count, total_depense: Math.round(s.spent), points: c.points, niveau: s.tier.id, segment: SEGMENTS[s.segment].label, optin: c.marketingOptIn ? 'oui' : 'non' }))))}><Download className="size-4" /> Exporter</button>
      } />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Clients" value={d.customers.length} />
        <Stat label="Taux de réachat" value={`${active.length ? Math.round((repeat / active.length) * 100) : 0} %`} tone="gold" />
        <Stat label="Valeur vie moyenne (LTV)" value={money(active.length ? active.reduce((a, r) => a + r.s.spent, 0) / active.length : 0)} tone="sky" />
        <Stat label="Clients VIP" value={count('vip')} tone="gold" />
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <Tabs value={seg} onChange={setSeg} tabs={[{ id: '' as const, label: 'Tous', count: rows.length }, ...(Object.keys(SEGMENTS) as Segment[]).map((s) => ({ id: s, label: SEGMENTS[s].label, count: count(s) }))]} />
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="spent">Trier : total dépensé</option><option value="last">Trier : dernière commande</option><option value="created">Trier : date d’inscription</option>
        </select>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-soft" />
          <input className="input pl-9" placeholder="Nom, téléphone, email, ville" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Client</th><th>Ville</th><th className="text-right">Commandes</th><th className="text-right">Total dépensé</th><th className="text-right">Panier moyen</th><th>Dernière commande</th><th>Niveau</th><th className="text-right">Points</th><th>Segment</th></tr></thead>
            <tbody>
              {list.slice(0, 120).map(({ c, s }) => (
                <tr key={c.id} className="cursor-pointer" onClick={() => nav(`/admin/clients/${c.id}`)}>
                  <td><div className="flex items-center gap-2.5 min-w-48"><Avatar name={`${c.firstName} ${c.lastName}`} /><div><div className="font-medium">{c.firstName} {c.lastName}</div><div className="text-[11px] text-muted">{c.phone}</div></div></div></td>
                  <td className="text-muted">{c.city}</td>
                  <td className="text-right tabular-nums">{s.count}</td>
                  <td className="text-right tabular-nums font-medium">{money(s.spent)}</td>
                  <td className="text-right tabular-nums text-muted">{money(s.avg)}</td>
                  <td className="text-muted whitespace-nowrap">{s.last ? date(s.last) : '—'}</td>
                  <td><span className="chip" style={{ background: s.tier.bg, color: s.tier.color }}>{s.tier.id}</span></td>
                  <td className="text-right tabular-nums">{c.points}</td>
                  <td><Badge tone={SEGMENTS[s.segment].tone} dot>{SEGMENTS[s.segment].label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
