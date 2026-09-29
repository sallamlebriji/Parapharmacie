import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown, Gift, Ticket } from 'lucide-react'
import { actions, useData, useTenant } from '../../lib/store'
import { date, money, num, sum } from '../../lib/format'
import { customerStats, TIERS } from '../../lib/logic'
import { REWARDS } from '../../data/plans'
import { Avatar, Badge, Card, Field, PageHeader, Stat, toast } from '../../components/ui'


export default function Loyalty() {
  const d = useData()
  const t = useTenant()
  const [sim, setSim] = useState(450)
  const rows = useMemo(() => d.customers.map((c) => ({ c, s: customerStats(d, c) })), [d])
  const byTier = TIERS.map((tier) => rows.filter((r) => r.s.tier.id === tier.id))
  const coupons = d.promotions.filter((p) => p.code)
  const perDh = t.settings.pointsPerDh

  return (
    <div>
      <PageHeader title="Programme de fidélité" subtitle="Points, niveaux, récompenses et bons d’achat — en boutique comme en ligne." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Membres actifs" value={num(rows.filter((r) => r.s.count > 0).length)} />
        <Stat label="Points en circulation" value={num(sum(d.customers, (c) => c.points))} tone="gold" />
        <Stat label="Valeur des points" value={money(sum(d.customers, (c) => c.points) * t.settings.pointValue)} tone="amber" hint="passif fidélité" />
        <Stat label="Coupons actifs" value={coupons.filter((c) => c.active).length} tone="sky" />
      </div>
      <div className="grid lg:grid-cols-4 gap-4 mb-4">
        {TIERS.map((tier, i) => (
          <div key={tier.id} className="card p-5 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 size-24 rounded-full opacity-60" style={{ background: tier.bg }} />
            <div className="relative">
              <div className="flex items-center gap-2"><Crown className="size-4" style={{ color: tier.color }} /><span className="font-display text-lg" style={{ color: tier.color }}>{tier.id}</span></div>
              <div className="text-xs text-muted mt-1">{tier.min ? `Dès ${money(tier.min)} sur 12 mois` : 'Dès l’inscription'}</div>
              <div className="text-2xl font-semibold mt-3 tabular-nums">{byTier[i].length} <span className="text-sm font-normal text-muted">membres</span></div>
              <ul className="mt-3 space-y-1 text-xs text-muted">{tier.perks.map((p) => <li key={p}>· {p}</li>)}</ul>
            </div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Règles du programme">
          <div className="space-y-3">
            <Field label="Points gagnés pour 10 DH dépensés">
              <input type="number" className="input" step="0.5" value={perDh * 10} onChange={(e) => actions.updateTenant({ settings: { pointsPerDh: +e.target.value / 10 } })} />
            </Field>
            <Field label="Valeur d’un point à l’utilisation (DH)">
              <input type="number" className="input" step="0.1" value={t.settings.pointValue} onChange={(e) => actions.updateTenant({ settings: { pointValue: +e.target.value } })} />
            </Field>
            <div className="rounded-xl bg-champagne-100/60 border border-champagne-200 p-4">
              <div className="text-xs text-champagne-600 font-medium mb-2">Simulateur</div>
              <div className="flex items-center gap-2 text-sm">
                Un panier de <input type="number" className="input h-8 w-24" value={sim} onChange={(e) => setSim(+e.target.value)} /> DH
              </div>
              <div className="text-sm mt-2">rapporte <b>{Math.floor(sim * perDh)} points</b>, soit <b>{money(Math.floor(sim * perDh) * t.settings.pointValue, true)}</b> de réduction future ({((perDh * t.settings.pointValue) * 100).toFixed(1).replace('.', ',')} % de retour).</div>
            </div>
            <p className="text-xs text-muted">Les points sont utilisables jusqu’à 50 % du montant d’une commande.</p>
          </div>
        </Card>
        <Card title="Catalogue de récompenses">
          <ul className="space-y-2">
            {REWARDS.map((r) => (
              <li key={r.cost} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <span className="size-9 rounded-lg bg-champagne-100 text-champagne-600 grid place-items-center"><Gift className="size-4" /></span>
                <div className="flex-1"><div className="text-sm font-medium">{r.label}</div><div className="text-[11px] text-muted">{r.desc}</div></div>
                <Badge tone="gold">{r.cost} pts</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Meilleurs membres">
          <ul className="space-y-3">
            {[...rows].sort((a, b) => b.s.spent12 - a.s.spent12).slice(0, 7).map(({ c, s }) => (
              <li key={c.id} className="flex items-center gap-3">
                <Avatar name={`${c.firstName} ${c.lastName}`} />
                <Link to={`/admin/clients/${c.id}`} className="flex-1 min-w-0"><div className="text-sm font-medium truncate hover:text-sage-600">{c.firstName} {c.lastName}</div><div className="text-[11px] text-muted">{money(s.spent12)} sur 12 mois</div></Link>
                <div className="text-right"><span className="chip" style={{ background: s.tier.bg, color: s.tier.color }}>{s.tier.id}</span><div className="text-[11px] text-muted mt-0.5">{c.points} pts</div></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card title={<span className="flex items-center gap-2"><Ticket className="size-4 text-champagne-400" /> Coupons & bons d’achat</span>} className="mt-4" padded={false}>
        <table className="table-base">
          <thead><tr><th>Code</th><th>Libellé</th><th>Valeur</th><th>Validité</th><th className="text-right">Utilisations</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {coupons.map((p) => (
              <tr key={p.id}>
                <td className="font-mono text-xs font-medium">{p.code}</td>
                <td>{p.name}</td>
                <td>{p.type === 'fixe' ? money(p.value) : `${p.value} %`}{p.minAmount ? <span className="text-[11px] text-muted"> dès {money(p.minAmount)}</span> : null}</td>
                <td className="text-muted whitespace-nowrap">{date(p.startsAt)} → {date(p.endsAt)}</td>
                <td className="text-right tabular-nums">{p.uses}</td>
                <td><Badge tone={p.active && new Date(p.endsAt) > new Date() ? 'sage' : 'neutral'} dot>{p.active && new Date(p.endsAt) > new Date() ? 'Actif' : 'Inactif'}</Badge></td>
                <td className="text-right"><button className="btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(p.code!); toast(`Code ${p.code} copié`) }}>Copier</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
