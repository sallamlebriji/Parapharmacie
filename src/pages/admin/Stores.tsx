import { useMemo, useState } from 'react'
import { MapPin, Phone, Plus, Users } from 'lucide-react'
import { actions, useData, useTenant } from '../../lib/store'
import { PLANS } from '../../data/plans'
import { money, sum, uid } from '../../lib/format'
import { ordersInRange, stockIndex, validOrders, variation } from '../../lib/logic'
import { seriesBy } from '../../lib/series'
import { Badge, Card, Field, Modal, PageHeader, cx, toast } from '../../components/ui'
import { Bars } from '../../components/charts'
import type { Store } from '../../lib/types'

export default function Stores() {
  const d = useData()
  const t = useTenant()
  const plan = PLANS.find((p) => p.id === t.plan)!
  const [edit, setEdit] = useState<Store | null>(null)
  const stats = useMemo(() => d.stores.map((s) => {
    const cur = ordersInRange(d, s.id, 29)
    const prev = ordersInRange(d, s.id, 59, 30)
    const ca = sum(cur, (o) => o.total - o.shipping)
    const idx = stockIndex(d, s.id)
    return {
      s, ca, delta: variation(ca, sum(prev, (o) => o.total - o.shipping)), orders: cur.length, avg: cur.length ? ca / cur.length : 0,
      web: cur.filter((o) => o.channel === 'web').length,
      stockValue: sum(d.lots.filter((l) => l.storeId === s.id), (l) => l.qty * (d.products.find((p) => p.id === l.productId)?.purchasePrice ?? 0)),
      low: d.products.filter((p) => idx(p).state !== 'ok').length,
      staff: d.employees.filter((e) => e.storeId === s.id && e.active).length,
    }
  }), [d])
  const series = useMemo(() => {
    const all = validOrders(d, 'all')
    return seriesBy(all, 'semaine', 10, () => Object.fromEntries(d.stores.map((s) => [s.id, 0])) as Record<string, number>, (acc, o) => { acc[o.storeId] += o.total - o.shipping })
      .map((r) => ({ ...r, ...Object.fromEntries(d.stores.map((s) => [s.id, Math.round(r[s.id])])) }))
  }, [d])
  const total = sum(stats, (x) => x.ca)

  return (
    <div>
      <PageHeader title="Boutiques" subtitle={`Dashboard direction — ${d.stores.length} / ${plan.limits.stores} boutiques incluses dans le plan ${plan.name}.`} actions={
        <button className="btn-primary" disabled={d.stores.length >= plan.limits.stores} title={d.stores.length >= plan.limits.stores ? 'Limite du plan atteinte' : ''} onClick={() => setEdit({ id: uid('st'), name: '', city: '', address: '', phone: '', manager: '', openedAt: new Date().toISOString().slice(0, 10) })}><Plus className="size-4" /> Ajouter une boutique</button>
      } />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
        {stats.map((x) => (
          <div key={x.s.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display text-lg">{x.s.name}</div>
                <div className="text-xs text-muted flex items-center gap-1 mt-0.5"><MapPin className="size-3" /> {x.s.address}, {x.s.city}</div>
              </div>
              <Badge tone="sage">{Math.round((x.ca / (total || 1)) * 100)} % du CA</Badge>
            </div>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-2xl font-semibold tabular-nums">{money(x.ca)}</span>
              <span className={cx('text-xs font-medium mb-1', x.delta >= 0 ? 'text-sage-600' : 'text-rose-ink')}>{x.delta >= 0 ? '+' : ''}{x.delta.toFixed(1).replace('.', ',')} %</span>
            </div>
            <div className="text-[11px] text-muted">CA 30 jours{x.web ? ` · dont ${x.web} commandes web préparées ici` : ''}</div>
            <dl className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-line text-sm">
              <div><dt className="text-[11px] text-muted">Ventes</dt><dd className="font-medium">{x.orders}</dd></div>
              <div><dt className="text-[11px] text-muted">Panier moyen</dt><dd className="font-medium">{money(x.avg)}</dd></div>
              <div><dt className="text-[11px] text-muted">Valeur stock</dt><dd className="font-medium">{money(x.stockValue)}</dd></div>
              <div><dt className="text-[11px] text-muted">Alertes stock</dt><dd className={cx('font-medium', x.low > 0 && 'text-amber-ink')}>{x.low}</dd></div>
            </dl>
            <div className="flex items-center justify-between mt-4 text-xs text-muted">
              <span className="flex items-center gap-1"><Users className="size-3.5" /> {x.staff} employés · resp. {x.s.manager}</span>
              <span className="flex items-center gap-1"><Phone className="size-3.5" /> {x.s.phone}</span>
            </div>
          </div>
        ))}
      </div>
      {d.stores.length > 1 && (
        <Card title="Comparatif hebdomadaire du chiffre d’affaires">
          <Bars data={series} x="label" unit="DH" series={d.stores.map((s) => ({ key: s.id, label: s.name }))} height={300} />
        </Card>
      )}
      {edit && (
        <Modal open onClose={() => setEdit(null)} title="Nouvelle boutique" footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Annuler</button><button className="btn-primary" onClick={() => { if (!edit.name || !edit.city) return toast('Nom et ville requis'); actions.saveStore(edit).then(() => toast('Boutique créée — stock, caisse et équipe dédiés')).catch(() => {}); setEdit(null) }}>Créer</button></>}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom" className="col-span-2"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={`${t.name.split(' ').pop()} Tanger`} /></Field>
            <Field label="Ville"><input className="input" value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></Field>
            <Field label="Téléphone"><input className="input" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Adresse" className="col-span-2"><input className="input" value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></Field>
            <Field label="Responsable" className="col-span-2"><input className="input" value={edit.manager} onChange={(e) => setEdit({ ...edit, manager: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
