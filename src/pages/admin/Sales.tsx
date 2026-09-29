import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { useData, useSession } from '../../lib/store'
import { dateTime, download, money, num, sum, toCSV } from '../../lib/format'
import { ordersInRange } from '../../lib/logic'
import { RANGES, revenueSeries } from '../../lib/series'
import { Badge, Card, PageHeader, PAYMENT_STATUS, StatusBadge, Tabs, Stat } from '../../components/ui'
import { Bars, Donut, Legendary } from '../../components/charts'

export default function Sales() {
  const d = useData()
  const { scope } = useSession()
  const [range, setRange] = useState('30')
  const [channel, setChannel] = useState<'all' | 'web' | 'pos'>('all')
  const [page, setPage] = useState(0)
  const R = RANGES.find((r) => r.id === range)!
  const orders = useMemo(() => ordersInRange(d, scope, R.days - 1).filter((o) => channel === 'all' || o.channel === channel).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [d, scope, R, channel])
  const ca = sum(orders, (o) => o.total - o.shipping)
  const byStore = d.stores.map((s) => ({ name: s.name, value: Math.round(sum(orders.filter((o) => o.storeId === s.id), (o) => o.total - o.shipping)) }))
  const methods = ['carte', 'especes', 'livraison', 'virement'].map((m) => ({ name: { carte: 'Carte bancaire', especes: 'Espèces', livraison: 'Paiement à la livraison', virement: 'Virement' }[m]!, value: Math.round(sum(orders.filter((o) => o.payment.method === m), (o) => o.total)) })).filter((x) => x.value)
  const series = revenueSeries(orders, R.g, R.count)
  const customers = new Map(d.customers.map((c) => [c.id, c]))
  const stores = new Map(d.stores.map((s) => [s.id, s]))
  const PER = 25
  const exportCSV = () => download(`ventes-${range}j.csv`, toCSV(orders.map((o) => ({ numero: o.number, date: o.createdAt, canal: o.channel, boutique: stores.get(o.storeId)?.name ?? '', client: o.customerId ? `${customers.get(o.customerId)?.firstName} ${customers.get(o.customerId)?.lastName}` : 'Passage', articles: sum(o.items, (i) => i.qty), sous_total: o.subtotal, remise: o.discount, livraison: o.shipping, total: o.total, paiement: o.payment.method, statut_paiement: o.payment.status }))))

  return (
    <div>
      <PageHeader title="Ventes" subtitle="Toutes les ventes, en boutique et en ligne, synchronisées en temps réel." actions={<>
        <Tabs tabs={RANGES.map((r) => ({ id: r.id, label: r.label }))} value={range} onChange={(v) => { setRange(v); setPage(0) }} />
        <button className="btn-secondary" onClick={exportCSV}><Download className="size-4" /> Exporter</button>
      </>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Chiffre d’affaires" value={money(ca)} />
        <Stat label="Nombre de ventes" value={num(orders.length)} />
        <Stat label="Panier moyen" value={money(orders.length ? ca / orders.length : 0)} />
        <Stat label="Articles vendus" value={num(sum(orders, (o) => sum(o.items, (i) => i.qty)))} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="Ventes par période" className="lg:col-span-2">
          <Bars data={series} x="label" unit="DH" series={[{ key: 'ca', label: 'CA' }]} height={240} />
        </Card>
        <Card title={scope === 'all' ? 'Par boutique' : 'Moyens de paiement'}>
          {(() => { const data = scope === 'all' ? byStore : methods; return <>
            <Donut data={data} unit="DH" height={150} />
            <div className="mt-3"><Legendary items={data.map((x) => ({ name: x.name, value: money(x.value) }))} /></div>
          </> })()}
        </Card>
      </div>
      <Card padded={false} title="Journal des ventes" action={<Tabs tabs={[{ id: 'all' as const, label: 'Tous canaux' }, { id: 'pos' as const, label: 'Boutiques' }, { id: 'web' as const, label: 'En ligne' }]} value={channel} onChange={(v) => { setChannel(v); setPage(0) }} />}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>N°</th><th>Date</th><th>Canal</th><th>Boutique</th><th>Client</th><th className="text-right">Articles</th><th className="text-right">Total</th><th>Paiement</th></tr></thead>
            <tbody>
              {orders.slice(page * PER, page * PER + PER).map((o) => {
                const c = o.customerId ? customers.get(o.customerId) : undefined
                return (
                  <tr key={o.id}>
                    <td><Link to={`/admin/commandes/${o.id}`} className="font-medium hover:text-sage-600">{o.number}</Link></td>
                    <td className="text-muted whitespace-nowrap">{dateTime(o.createdAt)}</td>
                    <td><Badge tone={o.channel === 'web' ? 'gold' : 'sage'}>{o.channel === 'web' ? 'En ligne' : 'Boutique'}</Badge></td>
                    <td className="text-muted">{stores.get(o.storeId)?.city}</td>
                    <td>{c ? <Link className="hover:text-sage-600" to={`/admin/clients/${c.id}`}>{c.firstName} {c.lastName}</Link> : <span className="text-soft">Client de passage</span>}</td>
                    <td className="text-right tabular-nums">{sum(o.items, (i) => i.qty)}</td>
                    <td className="text-right tabular-nums font-medium">{money(o.total)}</td>
                    <td><StatusBadge map={PAYMENT_STATUS} value={o.payment.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-3 text-xs text-muted">
          <span>{orders.length} ventes</span>
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Précédent</button>
            <button className="btn-secondary btn-sm" disabled={(page + 1) * PER >= orders.length} onClick={() => setPage(page + 1)}>Suivant</button>
          </div>
        </div>
      </Card>
    </div>
  )
}
