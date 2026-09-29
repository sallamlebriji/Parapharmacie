import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CalendarClock, Clock, CreditCard, PackageCheck, PackageX, ShoppingBag, ShoppingCart, Sparkles, TrendingUp, Truck, UserPlus, Wallet } from 'lucide-react'
import { useData, useSession } from '../../lib/store'
import { CATEGORY_LABEL } from '../../data/plans'
import { DAY, money, num, pct, sum } from '../../lib/format'
import { expiringLots, ordersInRange, productSales, stockIndex, validOrders, variation } from '../../lib/logic'
import { RANGES, revenueSeries, seriesBy, type Granularity } from '../../lib/series'
import { Badge, Card, PageHeader, Stat, Tabs, cx } from '../../components/ui'
import { Bars, Donut, Legendary, TrendChart } from '../../components/charts'
import { ProductVisual } from '../../components/ProductVisual'

export default function Dashboard() {
  const d = useData()
  const { scope, userName } = useSession()
  const [range, setRange] = useState('30')
  const [gran, setGran] = useState<Granularity>('jour')
  const R = RANGES.find((r) => r.id === range)!

  const m = useMemo(() => {
    const cur = ordersInRange(d, scope, R.days - 1)
    const prev = ordersInRange(d, scope, R.days * 2 - 1, R.days)
    const todayO = ordersInRange(d, scope, 0)
    const yesterday = ordersInRange(d, scope, 1, 1)
    const ca = sum(cur, (o) => o.total - o.shipping)
    const caPrev = sum(prev, (o) => o.total - o.shipping)
    const sold = sum(cur, (o) => sum(o.items, (i) => i.qty))
    const soldPrev = sum(prev, (o) => sum(o.items, (i) => i.qty))
    const idx = stockIndex(d, scope)
    const states = d.products.filter((p) => p.active).map((p) => ({ p, ...idx(p) }))
    const since = Date.now() - R.days * DAY
    const newCustomers = d.customers.filter((c) => new Date(c.createdAt).getTime() >= since).length
    const newPrev = d.customers.filter((c) => { const t = new Date(c.createdAt).getTime(); return t < since && t >= since - R.days * DAY }).length
    const pending = d.orders.filter((o) => o.channel === 'web' && (o.status === 'recue' || o.status === 'preparation') && (scope === 'all' || o.storeId === scope))
    const sales = productSales(cur)
    const top = [...sales.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 6).map(([id, v]) => ({ p: d.products.find((x) => x.id === id)!, ...v }))
    const cats = new Map<string, number>()
    cur.forEach((o) => o.items.forEach((i) => { const p = d.products.find((x) => x.id === i.productId)!; cats.set(p.category, (cats.get(p.category) ?? 0) + i.qty * i.unitPrice) }))
    const catData = [...cats.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: CATEGORY_LABEL[k], value: Math.round(v) }))
    const catTop = [...catData.slice(0, 5), { name: 'Autres', value: sum(catData.slice(5), (x) => x.value) }]
    return {
      cur, ca, caPrev, sold, soldPrev, todayO, yesterday, pending, top, catTop, newCustomers, newPrev,
      avg: cur.length ? ca / cur.length : 0, avgPrev: prev.length ? caPrev / prev.length : 0,
      rupture: states.filter((s) => s.state === 'rupture'), faible: states.filter((s) => s.state === 'faible'),
      exp30: expiringLots(d, 30, scope), exp7: expiringLots(d, 7, scope),
      toPrepare: pending.filter((o) => o.status === 'recue'), toShip: pending.filter((o) => o.status === 'preparation'),
      unpaid: d.orders.filter((o) => o.payment.status === 'en_attente' && o.status !== 'annulee' && (scope === 'all' || o.storeId === scope)),
    }
  }, [d, scope, R])

  const all = useMemo(() => validOrders(d, scope), [d, scope])
  const counts = { jour: 30, semaine: 12, mois: 6 }
  const revenue = useMemo(() => revenueSeries(all, gran, counts[gran]), [all, gran])
  const channel = useMemo(() => revenueSeries(all, 'semaine', 12), [all])
  const custMix = useMemo(() => {
    const created = new Map(d.customers.map((c) => [c.id, new Date(c.createdAt).getTime()]))
    return seriesBy(all.filter((o) => o.customerId), 'semaine', 12, () => ({ nouveaux: 0, existants: 0 }), (a, o) => {
      const isNew = new Date(o.createdAt).getTime() - (created.get(o.customerId!) ?? 0) < 30 * DAY
      if (isNew) a.nouveaux++; else a.existants++
    })
  }, [all, d.customers])
  const stockTrend = useMemo(() => {
    // Rebuild daily on-hand units backwards from today's stock using sales and receipts.
    const scopeOk = (s: string) => scope === 'all' || s === scope
    let units = sum(d.lots.filter((l) => scopeOk(l.storeId)), (l) => l.qty)
    const out: { label: string; stock: number }[] = []
    for (let i = 0; i < 30; i++) {
      const day = new Date(Date.now() - i * DAY).toISOString().slice(0, 10)
      out.unshift({ label: new Date(day).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }), stock: units })
      const sold = sum(all.filter((o) => o.createdAt.slice(0, 10) === day && o.status !== 'recue' && o.status !== 'preparation'), (o) => sum(o.items, (it) => it.qty))
      const received = sum(d.movements.filter((mv) => mv.type === 'entree' && mv.date.slice(0, 10) === day && scopeOk(mv.storeId)), (mv) => mv.qty)
      units = units + sold - received
    }
    return out
  }, [d, all, scope])

  const alerts = [
    { icon: AlertTriangle, tone: 'amber', text: `${m.faible.length} produits sont sous le seuil minimum.`, to: '/admin/stock?f=faible', show: m.faible.length > 0 },
    { icon: PackageX, tone: 'rose', text: `${m.rupture.length} produits en rupture de stock.`, to: '/admin/stock?f=rupture', show: m.rupture.length > 0 },
    { icon: CalendarClock, tone: 'rose', text: `${new Set(m.exp30.map((l) => l.productId)).size} produits arrivent bientôt à expiration (${m.exp7.length} lots sous 7 jours).`, to: '/admin/lots', show: m.exp30.length > 0 },
    { icon: PackageCheck, tone: 'sky', text: `${m.toPrepare.length} commandes à préparer.`, to: '/admin/commandes?s=recue', show: m.toPrepare.length > 0 },
    { icon: Truck, tone: 'gold', text: `${m.toShip.length} commandes prêtes à expédier.`, to: '/admin/commandes?s=preparation', show: m.toShip.length > 0 },
    { icon: CreditCard, tone: 'amber', text: `${m.unpaid.length} paiements en attente (${money(sum(m.unpaid, (o) => o.total))}).`, to: '/admin/commandes?p=en_attente', show: m.unpaid.length > 0 },
  ].filter((a) => a.show)

  const hour = new Date().getHours()
  return (
    <div>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${hour < 18 ? 'Bonjour' : 'Bonsoir'}, ${userName.split(' ')[0]}`}
        subtitle={scope === 'all' ? `Vue consolidée de vos ${d.stores.length} boutiques et de la boutique en ligne.` : `Vue de ${d.stores.find((s) => s.id === scope)?.name}.`}
        actions={<Tabs tabs={RANGES.map((r) => ({ id: r.id, label: r.label }))} value={range} onChange={setRange} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <Stat label="Chiffre d’affaires" value={money(m.ca)} delta={variation(m.ca, m.caPrev)} hint={`vs ${R.label} préc.`} icon={<Wallet className="size-4" />} to="/admin/ventes" />
        <Stat label="Commandes du jour" value={num(m.todayO.length)} delta={variation(m.todayO.length, m.yesterday.length)} hint="vs hier" icon={<ShoppingCart className="size-4" />} tone="sky" to="/admin/commandes" />
        <Stat label="Commandes en attente" value={num(m.pending.length)} hint="web à traiter" icon={<Clock className="size-4" />} tone="amber" to="/admin/commandes?s=recue" />
        <Stat label="Produits vendus" value={num(m.sold)} delta={variation(m.sold, m.soldPrev)} icon={<ShoppingBag className="size-4" />} tone="gold" />
        <Stat label="Panier moyen" value={money(m.avg)} delta={variation(m.avg, m.avgPrev)} icon={<TrendingUp className="size-4" />} />
        <Stat label="Produits en rupture" value={m.rupture.length} hint="à réapprovisionner" icon={<PackageX className="size-4" />} tone="rose" to="/admin/stock?f=rupture" />
        <Stat label="Stock faible" value={m.faible.length} hint="sous le seuil" icon={<AlertTriangle className="size-4" />} tone="amber" to="/admin/stock?f=faible" />
        <Stat label="Bientôt expirés" value={m.exp30.length} hint="lots ≤ 30 jours" icon={<CalendarClock className="size-4" />} tone="rose" to="/admin/lots" />
        <Stat label="Nouveaux clients" value={m.newCustomers} delta={variation(m.newCustomers, m.newPrev)} icon={<UserPlus className="size-4" />} tone="sky" to="/admin/clients" />
        <Stat label="Marge brute" value={pct(m.ca ? (sum(m.cur, (o) => sum(o.items, (i) => (i.unitPrice - i.unitCost) * i.qty) - o.discount) / m.ca) * 100 : 0)} hint="sur la période" icon={<Sparkles className="size-4" />} tone="gold" to="/admin/finance" />
      </div>

      <div className="grid xl:grid-cols-3 gap-4 mb-4">
        <Card className="xl:col-span-2" title="Chiffre d’affaires & marge" action={<Tabs tabs={[{ id: 'jour' as const, label: 'Jour' }, { id: 'semaine' as const, label: 'Semaine' }, { id: 'mois' as const, label: 'Mois' }]} value={gran} onChange={setGran} />}>
          <TrendChart data={revenue} x="label" unit="DH" series={[{ key: 'ca', label: 'Chiffre d’affaires' }, { key: 'marge', label: 'Marge brute', color: '#c9a96e' }]} height={280} />
        </Card>
        <Card title={<span className="flex items-center gap-2">Alertes importantes <Badge tone="rose">{alerts.length}</Badge></span>}>
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.text}>
                <Link to={a.to} className="group flex items-start gap-3 p-3 rounded-xl border border-line hover:border-sage-300 hover:bg-ivory transition">
                  <span className={cx('size-8 rounded-lg grid place-items-center shrink-0', { amber: 'bg-amber-soft text-amber-ink', rose: 'bg-rose-soft text-rose-ink', sky: 'bg-sky-soft text-sky-ink', gold: 'bg-champagne-100 text-champagne-600' }[a.tone])}>
                    <a.icon className="size-4" />
                  </span>
                  <span className="text-[13px] leading-snug flex-1 pt-1">{a.text}</span>
                  <ArrowRight className="size-4 text-soft group-hover:text-sage-600 mt-1.5 transition" />
                </Link>
              </li>
            ))}
            {!alerts.length && <li className="text-sm text-muted">Aucune alerte, tout est sous contrôle ✨</li>}
          </ul>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
        <Card title="Produits les plus vendus" action={<Link to="/admin/analytics" className="text-xs text-sage-600 hover:underline">Analytics</Link>}>
          <ul className="space-y-3">
            {m.top.map((t, i) => (
              <li key={t.p.id} className="flex items-center gap-3">
                <span className="w-4 text-xs text-soft tabular-nums">{i + 1}</span>
                <ProductVisual shape={t.p.shape} color={t.p.color} brand={t.p.brand} className="size-10 rounded-lg shrink-0" />
                <div className="min-w-0 flex-1">
                  <Link to={`/admin/produits/${t.p.id}`} className="block text-[13px] font-medium truncate hover:text-sage-600">{t.p.name}</Link>
                  <div className="text-[11px] text-muted">{t.p.brand}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-medium tabular-nums">{t.qty} u.</div>
                  <div className="text-[11px] text-muted tabular-nums">{money(t.revenue)}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Catégories les plus performantes">
          <Donut data={m.catTop} unit="DH" height={190} center={{ value: money(m.ca), label: 'CA période' }} />
          <div className="mt-4"><Legendary items={m.catTop.map((c) => ({ name: c.name, value: money(c.value) }))} /></div>
        </Card>
        <Card title="Évolution des commandes" className="lg:col-span-2 xl:col-span-1">
          <Bars data={channel} x="label" stacked series={[{ key: 'pos', label: 'Boutiques (POS)' }, { key: 'web', label: 'E-commerce', color: '#c9a96e' }]} height={300} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Évolution du stock (unités)">
          <TrendChart data={stockTrend} x="label" series={[{ key: 'stock', label: 'Unités en stock', color: '#7fa3c2' }]} height={220} />
        </Card>
        <Card title="Taux de marge commerciale">
          <TrendChart data={channel} x="label" unit="%" kind="line" series={[{ key: 'tauxMarge', label: 'Taux de marge', color: '#c9a96e' }]} height={220} />
        </Card>
        <Card title="Clients nouveaux vs existants">
          <Bars data={custMix} x="label" stacked series={[{ key: 'existants', label: 'Existants' }, { key: 'nouveaux', label: 'Nouveaux', color: '#7fa3c2' }]} height={220} />
        </Card>
      </div>
    </div>
  )
}
