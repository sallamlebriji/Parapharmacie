import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData, useSession } from '../../lib/store'
import { money, num, pct, sum } from '../../lib/format'
import { ordersInRange, productSales, validOrders, variation } from '../../lib/logic'
import { revenueSeries, seriesBy } from '../../lib/series'
import { Badge, Card, PageHeader, Stat, Tabs } from '../../components/ui'
import { Bars, TrendChart } from '../../components/charts'
import { ProductVisual } from '../../components/ProductVisual'

export default function Analytics() {
  const d = useData()
  const { scope } = useSession()
  const [tab, setTab] = useState<'ventes' | 'produits' | 'clients' | 'ecommerce'>('ventes')

  const a = useMemo(() => {
    const cur = ordersInRange(d, scope, 89)
    const prev = ordersInRange(d, scope, 179, 90)
    const ca = sum(cur, (o) => o.total - o.shipping)
    const caPrev = sum(prev, (o) => o.total - o.shipping)
    const web = cur.filter((o) => o.channel === 'web')
    const visits = sum(d.analytics.slice(-90), (x) => x.visits)
    const visitsPrev = sum(d.analytics.slice(-180, -90), (x) => x.visits)
    const webPrev = prev.filter((o) => o.channel === 'web')
    // products
    const sales = productSales(cur)
    const stockOf = (id: string) => sum(d.lots.filter((l) => l.productId === id && (scope === 'all' || l.storeId === scope)), (l) => l.qty)
    const prods = d.products.map((p) => {
      const s = sales.get(p.id) ?? { qty: 0, revenue: 0, margin: 0 }
      const stock = stockOf(p.id)
      const rotation = stock ? s.qty / ((stock + s.qty / 2) || 1) : s.qty ? 99 : 0 // turns over 90 days
      return { p, ...s, stock, rotation, coverage: s.qty ? Math.round(stock / (s.qty / 90)) : Infinity }
    })
    // customers
    const custOrders = (list: typeof cur) => new Set(list.filter((o) => o.customerId).map((o) => o.customerId!))
    const curSet = custOrders(cur)
    const prevSet = custOrders(prev)
    const retained = [...prevSet].filter((c) => curSet.has(c)).length
    const firstOrder = new Map<string, string>()
    validOrders(d, scope).forEach((o) => { if (o.customerId && (!firstOrder.has(o.customerId) || o.createdAt < firstOrder.get(o.customerId)!)) firstOrder.set(o.customerId, o.createdAt) })
    const since = Date.now() - 90 * 864e5
    const newC = [...curSet].filter((c) => new Date(firstOrder.get(c)!).getTime() >= since).length
    const allCust = [...firstOrder.keys()]
    const ltv = allCust.length ? sum(validOrders(d, scope).filter((o) => o.customerId), (o) => o.total) / allCust.length : 0
    return { cur, prev, ca, caPrev, web, webPrev, visits, visitsPrev, prods, curSet, prevSet, retained, newC, ltv }
  }, [d, scope])

  const weekly = useMemo(() => revenueSeries(validOrders(d, scope), 'semaine', 13), [d, scope])
  const weekday = useMemo(() => {
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    const acc = days.map((label) => ({ label, ca: 0, commandes: 0 }))
    a.cur.forEach((o) => { const i = (new Date(o.createdAt).getDay() + 6) % 7; acc[i].ca += o.total; acc[i].commandes++ })
    return acc.map((x) => ({ ...x, ca: Math.round(x.ca) }))
  }, [a.cur])
  const hours = useMemo(() => {
    const acc = Array.from({ length: 13 }, (_, i) => ({ label: `${i + 8}h`, commandes: 0 }))
    a.cur.forEach((o) => { const h = new Date(o.createdAt).getHours() - 8; if (acc[h]) acc[h].commandes++ })
    return acc
  }, [a.cur])
  const custSeries = useMemo(() => {
    const first = new Map<string, number>()
    validOrders(d, scope).forEach((o) => { if (o.customerId) { const t = new Date(o.createdAt).getTime(); if (!first.has(o.customerId) || t < first.get(o.customerId)!) first.set(o.customerId, t) } })
    return seriesBy(validOrders(d, scope).filter((o) => o.customerId), 'semaine', 13, () => ({ nouveaux: 0, recurrents: 0 }), (acc, o) => {
      if (new Date(o.createdAt).getTime() === first.get(o.customerId!)) acc.nouveaux++; else acc.recurrents++
    })
  }, [d, scope])
  const funnel = useMemo(() => {
    const weeks: { label: string; visites: number; paniers: number; conversion: number; abandon: number }[] = []
    const an = d.analytics
    for (let w = 0; w < 13; w++) {
      const slice = an.slice(an.length - (13 - w) * 7, an.length - (12 - w) * 7)
      const days = new Set(slice.map((x) => x.date))
      const orders = d.orders.filter((o) => o.channel === 'web' && days.has(o.createdAt.slice(0, 10))).length
      const v = sum(slice, (x) => x.visits), c = sum(slice, (x) => x.addToCart)
      weeks.push({ label: new Date(slice[0]?.date ?? Date.now()).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), visites: v, paniers: c, conversion: Math.round((orders / v) * 1000) / 10, abandon: Math.round(((c - orders) / c) * 1000) / 10 })
    }
    return weeks
  }, [d])

  const orders90 = a.cur.length
  const conv = a.web.length / a.visits * 100
  const convPrev = a.webPrev.length / a.visitsPrev * 100
  const best = [...a.prods].sort((x, y) => y.revenue - x.revenue)
  const worst = [...a.prods].filter((x) => x.p.active).sort((x, y) => x.qty - y.qty).slice(0, 8)

  return (
    <div>
      <PageHeader title="Analytics" subtitle="90 derniers jours comparés aux 90 jours précédents." actions={<Tabs value={tab} onChange={setTab} tabs={[{ id: 'ventes', label: 'Ventes' }, { id: 'produits', label: 'Produits' }, { id: 'clients', label: 'Clients' }, { id: 'ecommerce', label: 'E-commerce' }]} />} />

      {tab === 'ventes' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Chiffre d’affaires" value={money(a.ca)} delta={variation(a.ca, a.caPrev)} />
            <Stat label="Nombre de commandes" value={num(orders90)} delta={variation(orders90, a.prev.length)} />
            <Stat label="Panier moyen" value={money(a.ca / orders90)} delta={variation(a.ca / orders90, a.caPrev / a.prev.length)} />
            <Stat label="Taux de conversion web" value={pct(conv, 2)} delta={variation(conv, convPrev)} />
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <Card title="CA hebdomadaire & marge" className="lg:col-span-3"><TrendChart data={weekly} x="label" unit="DH" series={[{ key: 'ca', label: 'CA' }, { key: 'marge', label: 'Marge', color: '#c9a96e' }]} /></Card>
            <Card title="CA par jour de la semaine" className="lg:col-span-2"><Bars data={weekday} x="label" unit="DH" series={[{ key: 'ca', label: 'CA' }]} height={220} /></Card>
            <Card title="Affluence par heure"><Bars data={hours} x="label" series={[{ key: 'commandes', label: 'Ventes', color: '#7fa3c2' }]} height={220} /></Card>
          </div>
        </>
      )}

      {tab === 'produits' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Best sellers (CA)" padded={false}>
            <table className="table-base">
              <thead><tr><th>Produit</th><th className="text-right">Qté</th><th className="text-right">CA</th><th className="text-right">Marge</th></tr></thead>
              <tbody>{best.slice(0, 10).map((x) => (
                <tr key={x.p.id}><td><div className="flex items-center gap-2"><ProductVisual shape={x.p.shape} color={x.p.color} brand={x.p.brand} className="size-8 rounded-md" /><Link className="truncate max-w-52 hover:text-sage-600" to={`/admin/produits/${x.p.id}`}>{x.p.name}</Link></div></td><td className="text-right tabular-nums">{x.qty}</td><td className="text-right tabular-nums">{money(x.revenue)}</td><td className="text-right tabular-nums text-sage-600">{pct((x.margin / (x.revenue || 1)) * 100, 0)}</td></tr>
              ))}</tbody>
            </table>
          </Card>
          <Card title="Produits peu performants" padded={false}>
            <table className="table-base">
              <thead><tr><th>Produit</th><th className="text-right">Qté 90 j</th><th className="text-right">Stock</th><th className="text-right">Couverture</th></tr></thead>
              <tbody>{worst.map((x) => (
                <tr key={x.p.id}><td className="truncate max-w-60">{x.p.name}</td><td className="text-right tabular-nums">{x.qty}</td><td className="text-right tabular-nums">{x.stock}</td><td className="text-right">{x.coverage === Infinity ? <Badge tone="rose">∞</Badge> : <Badge tone={x.coverage > 180 ? 'amber' : 'neutral'}>{x.coverage} j</Badge>}</td></tr>
              ))}</tbody>
            </table>
          </Card>
          <Card title="Marge par produit (top 12)" className="lg:col-span-2"><Bars horizontal data={[...a.prods].sort((x, y) => y.margin - x.margin).slice(0, 12).map((x) => ({ label: x.p.name.length > 24 ? x.p.name.slice(0, 23) + '…' : x.p.name, marge: Math.round(x.margin) }))} x="label" unit="DH" series={[{ key: 'marge', label: 'Marge brute', color: '#c9a96e' }]} height={380} /></Card>
          <Card title="Rotation du stock (90 j)" className="lg:col-span-2" padded={false}>
            <div className="overflow-x-auto"><table className="table-base">
              <thead><tr><th>Produit</th><th className="text-right">Vendus</th><th className="text-right">Stock actuel</th><th className="text-right">Rotation</th><th className="text-right">Jours de couverture</th></tr></thead>
              <tbody>{[...a.prods].sort((x, y) => y.rotation - x.rotation).slice(0, 12).map((x) => (
                <tr key={x.p.id}><td>{x.p.name}</td><td className="text-right tabular-nums">{x.qty}</td><td className="text-right tabular-nums">{x.stock}</td><td className="text-right tabular-nums">{x.rotation === 99 ? '—' : `${x.rotation.toFixed(1).replace('.', ',')}×`}</td><td className="text-right tabular-nums">{x.coverage === Infinity ? '—' : x.coverage}</td></tr>
              ))}</tbody>
            </table></div>
          </Card>
        </div>
      )}

      {tab === 'clients' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Nouveaux clients (90 j)" value={a.newC} />
            <Stat label="Clients récurrents" value={a.curSet.size - a.newC} tone="gold" />
            <Stat label="Lifetime Value moyenne" value={money(a.ltv)} tone="sky" />
            <Stat label="Taux de fidélisation" value={pct((a.retained / Math.max(1, a.prevSet.size)) * 100, 0)} hint="clients du trimestre préc. revenus" />
          </div>
          <Card title="Commandes : nouveaux vs récurrents (par semaine)"><Bars data={custSeries} x="label" stacked series={[{ key: 'recurrents', label: 'Récurrents' }, { key: 'nouveaux', label: 'Nouveaux', color: '#7fa3c2' }]} height={280} /></Card>
        </>
      )}

      {tab === 'ecommerce' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Visites (90 j)" value={num(a.visits)} delta={variation(a.visits, a.visitsPrev)} />
            <Stat label="Ajouts au panier" value={num(sum(d.analytics.slice(-90), (x) => x.addToCart))} tone="gold" />
            <Stat label="Taux d’abandon" value={pct(100 - (a.web.length / sum(d.analytics.slice(-90), (x) => x.addToCart)) * 100, 0)} tone="rose" />
            <Stat label="Conversion" value={pct(conv, 2)} delta={variation(conv, convPrev)} tone="sky" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Visites & ajouts au panier"><TrendChart data={funnel} x="label" series={[{ key: 'visites', label: 'Visites' }, { key: 'paniers', label: 'Ajouts panier', color: '#c9a96e' }]} /></Card>
            <Card title="Conversion & abandon (%)"><TrendChart kind="line" data={funnel} x="label" unit="%" series={[{ key: 'conversion', label: 'Conversion', color: '#5f7d68' }, { key: 'abandon', label: 'Abandon panier', color: '#c98a7f' }]} /></Card>
          </div>
        </>
      )}
    </div>
  )
}
