import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Gift, Mail, MapPin, MessageSquare, Phone } from 'lucide-react'
import { actions, useData } from '../../lib/store'
import { date, money } from '../../lib/format'
import { complementary, customerStats, SEGMENTS } from '../../lib/logic'
import { SKIN_TYPES } from '../../data/catalog'
import { Avatar, Badge, Card, Empty, Field, Modal, ORDER_STATUS, PageHeader, Progress, StatusBadge, cx, toast } from '../../components/ui'
import { ProductVisual } from '../../components/ProductVisual'

export default function CustomerDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const d = useData()
  const [pts, setPts] = useState<number | null>(null)
  const c = d.customers.find((x) => x.id === id)
  if (!c) return <Empty title="Client introuvable" />
  const s = customerStats(d, c)
  const favs = c.favorites.map((fid) => d.products.find((p) => p.id === fid)!).filter(Boolean)
  const reco = favs[0] ? complementary(d, favs[0], 3).filter((p) => !c.favorites.includes(p.id)) : []

  return (
    <div>
      <button onClick={() => nav(-1)} className="btn-ghost btn-sm mb-3 -ml-2"><ArrowLeft className="size-4" /> Clients</button>
      <PageHeader title={`${c.firstName} ${c.lastName}`} subtitle={`Client depuis le ${date(c.createdAt)}`} actions={<>
        <button className="btn-secondary" onClick={() => setPts(50)}><Gift className="size-4" /> Ajuster les points</button>
        <Link to="/admin/messages" className="btn-secondary"><MessageSquare className="size-4" /> Message</Link>
      </>} />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-3">
              <Avatar name={`${c.firstName} ${c.lastName}`} className="size-12 text-sm" />
              <div className="flex flex-wrap gap-1.5">
                <span className="chip" style={{ background: s.tier.bg, color: s.tier.color }}>{s.tier.id}</span>
                <Badge tone={SEGMENTS[s.segment].tone} dot>{SEGMENTS[s.segment].label}</Badge>
                {c.marketingOptIn && <Badge tone="sky">Opt-in marketing</Badge>}
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center gap-2"><Phone className="size-4 text-soft" /> {c.phone}</li>
              <li className="flex items-center gap-2"><Mail className="size-4 text-soft" /> {c.email}</li>
              <li className="flex items-start gap-2"><MapPin className="size-4 text-soft mt-0.5" /> {c.address}, {c.city}</li>
              {c.skinType && <li className="text-muted">Profil : {SKIN_TYPES[c.skinType]}</li>}
            </ul>
          </Card>
          <Card title="Fidélité">
            <div className="flex items-end justify-between">
              <div><div className="text-3xl font-semibold tabular-nums">{c.points}</div><div className="text-xs text-muted">points disponibles · {money(c.points * 0.5)} de réduction</div></div>
            </div>
            {s.next && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted mb-1.5"><span>{s.tier.id}</span><span>{s.next.id} à {money(s.next.min)} (12 mois)</span></div>
                <Progress value={(s.spent12 / s.next.min) * 100} tone="gold" />
                <div className="text-xs text-muted mt-1.5">Encore {money(s.next.min - s.spent12)} pour passer {s.next.id}</div>
              </div>
            )}
            <div className="mt-4">
              <div className="text-xs text-muted mb-1.5">Coupons utilisés</div>
              <div className="flex flex-wrap gap-1.5">{c.couponsUsed.length ? c.couponsUsed.map((x, i) => <Badge key={i} tone="gold">{x}</Badge>) : <span className="text-sm text-soft">Aucun</span>}</div>
            </div>
          </Card>
          <Card title="Activité" subtitle="Achats en boutique et en ligne">
            <ol className="relative border-l border-line ml-1.5 space-y-4">
              {s.orders.slice(0, 8).map((o) => (
                <li key={o.id} className="pl-4 relative">
                  <span className={cx('absolute -left-[5px] top-1.5 size-2.5 rounded-full ring-4 ring-surface', o.channel === 'web' ? 'bg-teal-500' : 'bg-sage-500')} />
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <Link to={`/admin/commandes/${o.id}`} className="font-medium hover:text-sage-600">{o.channel === 'web' ? 'Commande en ligne' : 'Achat en boutique'}</Link>
                    <span className="font-semibold num">{money(o.total)}</span>
                  </div>
                  <div className="text-[11px] text-muted num">{date(o.createdAt)} · {o.number} · {o.items.reduce((a, i) => a + i.qty, 0)} article(s)</div>
                </li>
              ))}
              <li className="pl-4 relative">
                <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full ring-4 ring-surface bg-champagne-400" />
                <div className="text-[13px] font-medium">Création du compte client</div>
                <div className="text-[11px] text-muted">{date(c.createdAt)}</div>
              </li>
            </ol>
          </Card>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['Total dépensé', money(s.spent)], ['Commandes', s.count], ['Panier moyen', money(s.avg)], ['Dernière commande', s.last ? date(s.last) : '—']].map(([k, v]) => (
              <div key={k as string} className="card p-4"><div className="text-xs text-muted">{k}</div><div className="text-lg font-semibold mt-1 tabular-nums">{v}</div></div>
            ))}
          </div>
          <Card title="Produits favoris">
            {favs.length ? (
              <div className="grid sm:grid-cols-3 gap-3">
                {favs.map((p) => (
                  <Link key={p.id} to={`/admin/produits/${p.id}`} className="flex items-center gap-2.5 rounded-xl border border-line p-2 hover:border-sage-300">
                    <ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="size-10 rounded-lg" />
                    <span className="text-[13px] leading-tight">{p.name}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-muted">Pas encore d’historique.</p>}
            {reco.length > 0 && <div className="mt-4 text-xs text-muted">Suggestions pour la prochaine visite : {reco.map((p) => p.name).join(' · ')}</div>}
          </Card>
          <Card title="Historique des commandes" padded={false}>
            <table className="table-base">
              <thead><tr><th>N°</th><th>Date</th><th>Canal</th><th className="text-right">Articles</th><th className="text-right">Total</th><th>Statut</th></tr></thead>
              <tbody>
                {s.orders.slice(0, 20).map((o) => (
                  <tr key={o.id}>
                    <td><Link to={`/admin/commandes/${o.id}`} className="font-medium hover:text-sage-600">{o.number}</Link></td>
                    <td className="text-muted">{date(o.createdAt)}</td>
                    <td><Badge tone={o.channel === 'web' ? 'gold' : 'sage'}>{o.channel === 'web' ? 'En ligne' : 'Boutique'}</Badge></td>
                    <td className="text-right">{o.items.reduce((a, i) => a + i.qty, 0)}</td>
                    <td className="text-right tabular-nums font-medium">{money(o.total)}</td>
                    <td><StatusBadge map={ORDER_STATUS} value={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
      <Modal open={pts !== null} onClose={() => setPts(null)} title="Ajuster les points" footer={<><button className="btn-secondary" onClick={() => setPts(null)}>Annuler</button><button className="btn-primary" onClick={() => { actions.adjustPoints(c.id, pts ?? 0).then(() => toast('Points mis à jour')).catch(() => {}); setPts(null) }}>Valider</button></>}>
        <Field label="Points à ajouter (négatif pour retirer)"><input type="number" className="input" value={pts ?? 0} onChange={(e) => setPts(+e.target.value)} /></Field>
        <p className="text-xs text-muted mt-2">Nouveau solde : {Math.max(0, c.points + (pts ?? 0))} points</p>
      </Modal>
    </div>
  )
}
