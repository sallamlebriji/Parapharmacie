import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, Search, Tag, Trash2 } from 'lucide-react'
import { actions, useData, useSession } from '../../lib/store'
import { date, daysUntil, money, sum } from '../../lib/format'
import { Badge, Card, PageHeader, Tabs, Toggle, cx, toast } from '../../components/ui'
import { ProductVisual } from '../../components/ProductVisual'

const WINDOWS = [7, 30, 60, 90] as const

export default function Lots() {
  const d = useData()
  const { scope } = useSession()
  const [win, setWin] = useState<string>('30')
  const [q, setQ] = useState('')
  const [alerts, setAlerts] = useState({ 90: true, 60: true, 30: true, 7: true })
  const lots = d.lots.filter((l) => l.qty > 0 && (scope === 'all' || l.storeId === scope))
  const inWin = (days: number) => lots.filter((l) => daysUntil(l.expiresAt) <= days)
  const list = (win === 'tous' ? lots : win === 'expires' ? lots.filter((l) => daysUntil(l.expiresAt) < 0) : inWin(+win))
    .filter((l) => { const p = d.products.find((x) => x.id === l.productId)!; return !q || `${p.name} ${l.number} ${p.brand}`.toLowerCase().includes(q.toLowerCase()) })
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
  const cost = (l: typeof lots[number]) => l.qty * (d.products.find((p) => p.id === l.productId)?.purchasePrice ?? 0)
  const expired = lots.filter((l) => daysUntil(l.expiresAt) < 0)
  // Units expiring per week over the next 13 weeks — the timeline shows when the pressure comes.
  const weeks = Array.from({ length: 13 }, (_, w) => {
    const inWeek = lots.filter((l) => { const dd = daysUntil(l.expiresAt); return dd >= w * 7 && dd < (w + 1) * 7 })
    return { w, units: sum(inWeek, (l) => l.qty), lots: inWeek.length }
  })
  const peak = Math.max(1, ...weeks.map((w) => w.units))

  return (
    <div>
      <PageHeader title="Lots & expirations" subtitle="Traçabilité complète par numéro de lot, date de réception et fournisseur." />
      {expired.length > 0 && (
        <button onClick={() => setWin('expires')} className="w-full mb-4 card card-hover flex items-center gap-3 px-4 py-3 text-sm text-left cursor-pointer border-l-4 border-l-rose-ink">
          <span className="size-9 rounded-xl grid place-items-center bg-rose-soft text-rose-ink shrink-0"><Trash2 className="size-4" aria-hidden /></span>
          <span><b className="text-rose-ink num">{expired.length} lots expirés</b> encore en stock ({sum(expired, (l) => l.qty)} unités) — à retirer de la vente.</span>
        </button>
      )}
      <Card title="Calendrier des expirations" subtitle="Unités qui arrivent à expiration, semaine par semaine (13 semaines)" className="mb-4">
        <div className="flex items-end gap-1.5 h-32" role="list">
          {weeks.map((w) => (
            <div key={w.w} role="listitem" className="flex-1 h-full flex flex-col justify-end items-center gap-1.5 group" title={`Semaine ${w.w + 1} : ${w.units} unités (${w.lots} lots)`}>
              <span className="text-[10px] text-muted num opacity-0 group-hover:opacity-100 transition-opacity">{w.units || ''}</span>
              <div
                className={cx('w-full rounded-md origin-bottom transition-transform duration-700 ease-signature', w.w === 0 ? 'bg-rose-ink' : w.w < 5 ? 'bg-amber-ink/80' : 'bg-sage-300', w.units === 0 && 'bg-cream')}
                style={{ height: `${Math.max(4, (w.units / peak) * 100)}%` }}
              />
              <span className="text-[10px] text-soft">S{w.w + 1}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-rose-ink" />Cette semaine</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-amber-ink/80" />Sous 30 jours</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-sage-300" />Plus tard</span>
        </div>
      </Card>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {WINDOWS.map((w) => {
          const l = inWin(w)
          return (
            <button key={w} onClick={() => setWin(String(w))} className={cx('card p-4 text-left cursor-pointer transition hover:shadow-lift', win === String(w) && 'ring-2 ring-sage-400 border-sage-300')}>
              <div className="text-xs text-muted">Expire dans {w} jours</div>
              <div className={cx('text-2xl font-semibold mt-1 tabular-nums', w <= 7 ? 'text-rose-ink' : w <= 30 ? 'text-amber-ink' : 'text-ink')}>{l.length} <span className="text-sm font-normal text-muted">lots</span></div>
              <div className="text-xs text-muted mt-1">{sum(l, (x) => x.qty)} unités · {money(sum(l, cost))} au coût</div>
            </button>
          )
        })}
      </div>
      <div className="grid lg:grid-cols-4 gap-4">
        <Card padded={false} className="lg:col-span-3">
          <div className="flex flex-wrap items-center gap-3 p-4">
            <Tabs value={win} onChange={setWin} tabs={[{ id: 'expires', label: 'Expirés', count: lots.filter((l) => daysUntil(l.expiresAt) < 0).length }, ...WINDOWS.map((w) => ({ id: String(w), label: `≤ ${w} j` })), { id: 'tous', label: 'Tous les lots' }]} />
            <div className="relative ml-auto w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-soft" />
              <input className="input pl-9" placeholder="Produit ou n° de lot" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Produit</th><th>N° lot</th><th>Boutique</th><th className="text-right">Qté</th><th>Réception</th><th>Expiration</th><th>Fournisseur</th><th></th></tr></thead>
              <tbody>
                {list.slice(0, 150).map((l) => {
                  const p = d.products.find((x) => x.id === l.productId)!
                  const days = daysUntil(l.expiresAt)
                  return (
                    <tr key={l.id}>
                      <td><div className="flex items-center gap-2.5 min-w-52"><ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="size-9 rounded-lg shrink-0" /><Link to={`/admin/produits/${p.id}`} className="truncate max-w-56 hover:text-sage-600">{p.name}</Link></div></td>
                      <td className="font-mono text-xs">{l.number}</td>
                      <td>{d.stores.find((s) => s.id === l.storeId)?.city}</td>
                      <td className="text-right tabular-nums font-medium">{l.qty}</td>
                      <td className="text-muted whitespace-nowrap">{date(l.receivedAt)}</td>
                      <td className="whitespace-nowrap">{date(l.expiresAt)} <Badge tone={days <= 7 ? 'rose' : days <= 30 ? 'amber' : days <= 90 ? 'gold' : 'neutral'}>{days < 0 ? 'Expiré' : `J-${days}`}</Badge></td>
                      <td className="text-muted text-xs max-w-40 truncate">{d.suppliers.find((s) => s.id === l.supplierId)?.name}</td>
                      <td className="text-right whitespace-nowrap">
                        {days <= 90 && !p.promoPrice && <button className="btn-ghost btn-sm" title="Déstocker en promotion −30 %" onClick={() => { actions.saveProduct({ ...p, promoPrice: Math.round(p.price * 0.7) }).then(() => toast(`${p.name} passé en promotion −30 %`)).catch(() => {}) }}><Tag className="size-3.5" /> Promo</button>}
                        {days <= 7 && <button className="btn-ghost btn-sm text-rose-ink" title="Retirer de la vente" onClick={() => { actions.adjustStock(p.id, l.storeId, -l.qty, `Retrait lot ${l.number} (péremption)`, 'sortie').then(() => toast(`Lot ${l.number} retiré`)).catch(() => {}) }}><Trash2 className="size-3.5" /> Retirer</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={<span className="flex items-center gap-2"><BellRing className="size-4 text-sage-500" /> Notifications automatiques</span>}>
          <p className="text-xs text-muted mb-4">Recevez une alerte (tableau de bord, email) lorsqu’un lot atteint ces échéances.</p>
          <ul className="space-y-3">
            {([90, 60, 30, 7] as const).map((w) => (
              <li key={w} className="flex items-center justify-between text-sm">
                <span>Alerte à J-{w}</span>
                <Toggle on={alerts[w]} onChange={(v) => { setAlerts({ ...alerts, [w]: v }); toast(`Alerte J-${w} ${v ? 'activée' : 'désactivée'}`) }} label={`Alerte J-${w}`} />
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-xl bg-sage-50 border border-sage-100 p-3 text-xs text-sage-800 leading-relaxed">
            <b>Règle FEFO active :</b> les ventes en caisse et les expéditions web prélèvent automatiquement le lot qui expire en premier.
          </div>
        </Card>
      </div>
    </div>
  )
}
