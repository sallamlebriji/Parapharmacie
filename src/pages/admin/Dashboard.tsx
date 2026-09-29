import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { m as Mo } from 'framer-motion'
import { AlertTriangle, ArrowRight, CalendarClock, CreditCard, PackageCheck, PackageX, ShoppingBag, Truck, Users } from 'lucide-react'
import { useData, useSession } from '../../lib/store'
import { CATEGORY_LABEL } from '../../data/plans'
import { DAY, daysUntil, dateTime, money, num, pct, sum } from '../../lib/format'
import { expiringLots, orderMargin, ordersInRange, productSales, stockIndex, validOrders, variation } from '../../lib/logic'
import { RANGES, revenueSeries, seriesBy, type Granularity } from '../../lib/series'
import { EASE } from '../../lib/motion'
import { AnimatedNumber, Badge, Card, Delta, Empty, ORDER_STATUS, PageHeader, StatusBadge, Tabs, cx } from '../../components/ui'
import { Bars, Donut, Legendary, TrendChart } from '../../components/charts'
import { ProductVisual } from '../../components/ProductVisual'

/** Circular gauge (SVG) — share of active products with healthy stock. */
function HealthRing({ value }: { value: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const tone = value >= 85 ? 'var(--color-sage-500)' : value >= 70 ? 'var(--color-amber-ink)' : 'var(--color-rose-ink)'
  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-cream)" strokeWidth="10" />
        <Mo.circle cx="60" cy="60" r={r} fill="none" stroke={tone} strokeWidth="10" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1.6, ease: EASE }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-3xl font-semibold text-ink"><AnimatedNumber value={`${Math.round(value)} %`} /></div>
          <div className="text-[11px] text-muted">stock sain</div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const d = useData()
  const { scope, userName } = useSession()
  const [range, setRange] = useState('30')
  const [gran, setGran] = useState<Granularity>('jour')
  const [productTab, setProductTab] = useState<'top' | 'lent'>('top')
  const [insight, setInsight] = useState<'categories' | 'canaux' | 'clients' | 'stock' | 'marge'>('categories')
  const R = RANGES.find((r) => r.id === range)!

  const m = useMemo(() => {
    const cur = ordersInRange(d, scope, R.days - 1)
    const prev = ordersInRange(d, scope, R.days * 2 - 1, R.days)
    const ca = sum(cur, (o) => o.total - o.shipping)
    const caPrev = sum(prev, (o) => o.total - o.shipping)
    const margin = sum(cur, orderMargin)
    const marginPrev = sum(prev, orderMargin)
    const sold = sum(cur, (o) => sum(o.items, (i) => i.qty))
    const soldPrev = sum(prev, (o) => sum(o.items, (i) => i.qty))
    const idx = stockIndex(d, scope)
    const states = d.products.filter((p) => p.active).map((p) => ({ p, ...idx(p) }))
    const since = Date.now() - R.days * DAY
    const newCustomers = d.customers.filter((c) => new Date(c.createdAt).getTime() >= since).length
    const newPrev = d.customers.filter((c) => { const t = new Date(c.createdAt).getTime(); return t < since && t >= since - R.days * DAY }).length
    const active90 = new Set(ordersInRange(d, scope, 89).filter((o) => o.customerId).map((o) => o.customerId)).size
    const pending = d.orders.filter((o) => o.channel === 'web' && (o.status === 'recue' || o.status === 'preparation') && (scope === 'all' || o.storeId === scope))
    const sales = productSales(cur)
    const top = [...sales.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 5).map(([id, v]) => ({ p: d.products.find((x) => x.id === id)!, ...v })).filter((x) => x.p)
    // Slow movers: products in stock that sold the least over the period.
    const slow = states.filter((s) => s.physical > 0).map((s) => ({ p: s.p, qty: sales.get(s.p.id)?.qty ?? 0, revenue: sales.get(s.p.id)?.revenue ?? 0, stock: s.physical })).sort((a, b) => a.qty - b.qty || b.stock - a.stock).slice(0, 5)
    const cats = new Map<string, number>()
    cur.forEach((o) => o.items.forEach((i) => { const p = d.products.find((x) => x.id === i.productId); if (p) cats.set(p.category, (cats.get(p.category) ?? 0) + i.qty * i.unitPrice) }))
    const catData = [...cats.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: CATEGORY_LABEL[k], value: Math.round(v) }))
    const catTop = [...catData.slice(0, 5), { name: 'Autres', value: sum(catData.slice(5), (x) => x.value) }].filter((x) => x.value > 0)
    const openPOs = d.purchaseOrders.filter((p) => (p.status === 'envoyee' || p.status === 'partielle') && (scope === 'all' || p.storeId === scope))
    const unpaidInvoices = d.purchaseOrders.filter((p) => p.invoice && !p.invoice.paid && (scope === 'all' || p.storeId === scope))
    return {
      cur, ca, caPrev, margin, marginPrev, sold, soldPrev, pending, top, slow, catTop, newCustomers, newPrev, active90, states, openPOs, unpaidInvoices,
      avg: cur.length ? ca / cur.length : 0, avgPrev: prev.length ? caPrev / prev.length : 0, prevCount: prev.length,
      ok: states.filter((s) => s.state === 'ok'),
      rupture: states.filter((s) => s.state === 'rupture'), faible: states.filter((s) => s.state === 'faible'),
      exp30: expiringLots(d, 30, scope), exp7: expiringLots(d, 7, scope), exp90: expiringLots(d, 90, scope),
      toPrepare: pending.filter((o) => o.status === 'recue'), toShip: pending.filter((o) => o.status === 'preparation'),
      unpaid: d.orders.filter((o) => o.payment.status === 'en_attente' && o.status !== 'annulee' && (scope === 'all' || o.storeId === scope)),
      stockValue: sum(d.lots.filter((l) => scope === 'all' || l.storeId === scope), (l) => l.qty * (d.products.find((p) => p.id === l.productId)?.purchasePrice ?? 0)),
      loyaltyMembers: d.customers.filter((c) => c.points > 0).length,
    }
  }, [d, scope, R])

  const all = useMemo(() => validOrders(d, scope), [d, scope])
  const counts = { jour: 30, semaine: 12, mois: 6 }
  const revenue = useMemo(() => revenueSeries(all, gran, counts[gran]), [all, gran]) // eslint-disable-line react-hooks/exhaustive-deps
  const weekly = useMemo(() => revenueSeries(all, 'semaine', 12), [all])
  const custMix = useMemo(() => {
    const created = new Map(d.customers.map((c) => [c.id, new Date(c.createdAt).getTime()]))
    return seriesBy(all.filter((o) => o.customerId), 'semaine', 12, () => ({ nouveaux: 0, existants: 0 }), (a, o) => {
      if (new Date(o.createdAt).getTime() - (created.get(o.customerId!) ?? 0) < 30 * DAY) a.nouveaux++; else a.existants++
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
      const soldDay = sum(all.filter((o) => o.createdAt.slice(0, 10) === day && o.status !== 'recue' && o.status !== 'preparation'), (o) => sum(o.items, (it) => it.qty))
      const received = sum(d.movements.filter((mv) => mv.type === 'entree' && mv.date.slice(0, 10) === day && scopeOk(mv.storeId)), (mv) => mv.qty)
      units = units + soldDay - received
    }
    return out
  }, [d, all, scope])

  const todo = [
    { icon: PackageCheck, tone: 'sky', n: m.toPrepare.length, text: 'commandes à préparer', to: '/admin/commandes?s=recue' },
    { icon: Truck, tone: 'teal', n: m.toShip.length, text: 'commandes prêtes à expédier', to: '/admin/commandes?s=preparation' },
    { icon: CreditCard, tone: 'amber', n: m.unpaid.length, text: `paiements en attente · ${money(sum(m.unpaid, (o) => o.total))}`, to: '/admin/commandes?p=en_attente' },
    { icon: ShoppingBag, tone: 'gold', n: m.openPOs.length, text: 'bons fournisseurs à réceptionner', to: '/admin/achats' },
  ].filter((a) => a.n > 0)

  const customers = new Map(d.customers.map((c) => [c.id, c]))
  const recent = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 7)
  const healthy = m.states.length ? (m.ok.length / m.states.length) * 100 : 100
  const maxQty = Math.max(1, ...m.top.map((t) => t.qty))
  const hour = new Date().getHours()
  const tones: Record<string, string> = { amber: 'bg-amber-soft text-amber-ink', rose: 'bg-rose-soft text-rose-ink', sky: 'bg-sky-soft text-sky-ink', gold: 'bg-champagne-100 text-champagne-600', teal: 'bg-teal-100 text-teal-600' }

  return (
    <div>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${hour < 18 ? 'Bonjour' : 'Bonsoir'}, ${userName.split(' ')[0]}`}
        subtitle={scope === 'all' ? `Vue consolidée de vos ${d.stores.length} boutiques et de la boutique en ligne.` : `Vue de ${d.stores.find((s) => s.id === scope)?.name}.`}
        actions={<Tabs tabs={RANGES.map((r) => ({ id: r.id, label: r.label }))} value={range} onChange={setRange} />}
      />

      {/* 1 · Activité + santé du stock */}
      <div className="grid xl:grid-cols-3 gap-4 mb-4">
        <section className="xl:col-span-2 card ring-gradient relative overflow-hidden" aria-labelledby="activite">
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-sage-100/60 blur-3xl animate-breathe" aria-hidden />
          <div className="relative p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="activite" className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-soft">Chiffre d’affaires · {R.label}</h2>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-4xl md:text-5xl font-semibold tracking-tight text-ink"><AnimatedNumber value={money(m.ca)} /></span>
                  <span className="text-sm"><Delta value={variation(m.ca, m.caPrev)} suffix={`vs ${R.label} préc.`} /></span>
                </div>
              </div>
              <Tabs tabs={[{ id: 'jour' as const, label: 'Jour' }, { id: 'semaine' as const, label: 'Semaine' }, { id: 'mois' as const, label: 'Mois' }]} value={gran} onChange={setGran} />
            </div>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {[
                { k: 'Ventes', v: num(m.cur.length), dv: variation(m.cur.length, m.prevCount), to: '/admin/ventes' },
                { k: 'Panier moyen', v: money(m.avg), dv: variation(m.avg, m.avgPrev) },
                { k: 'Articles vendus', v: num(m.sold), dv: variation(m.sold, m.soldPrev) },
                { k: 'Marge brute', v: pct(m.ca ? (m.margin / m.ca) * 100 : 0), dv: variation(m.margin, m.marginPrev), to: '/admin/finance' },
              ].map((x) => (
                <div key={x.k} className="rounded-xl bg-ivory/70 border border-line px-3.5 py-3">
                  <dt className="text-[11px] text-muted">{x.to ? <Link to={x.to} className="hover:text-ink">{x.k}</Link> : x.k}</dt>
                  <dd className="mt-1 text-lg font-semibold text-ink"><AnimatedNumber value={x.v} /></dd>
                  <dd className="text-[11px]"><Delta value={x.dv} /></dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 -mx-1">
              <TrendChart data={revenue} x="label" unit="DH" series={[{ key: 'ca', label: 'Chiffre d’affaires' }, { key: 'marge', label: 'Marge brute', color: 'var(--color-champagne-400)' }]} height={240} />
            </div>
          </div>
        </section>

        <Card title="Santé du stock" subtitle={`${m.states.length} références actives · valeur ${money(m.stockValue)}`} action={<Link to="/admin/stock" className="text-xs text-sage-600 hover:underline">Stock</Link>}>
          <div className="flex items-center gap-5">
            <HealthRing value={healthy} />
            <ul className="flex-1 space-y-2.5 text-sm">
              <li className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-muted"><span className="size-2 rounded-full bg-sage-500" />Disponible</span><b className="num">{m.ok.length}</b></li>
              <li className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-muted"><span className="size-2 rounded-full bg-amber-ink" />Stock faible</span><b className="num text-amber-ink">{m.faible.length}</b></li>
              <li className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-muted"><span className="size-2 rounded-full bg-rose-ink" />Rupture</span><b className="num text-rose-ink">{m.rupture.length}</b></li>
            </ul>
          </div>
          <div className="mt-5 space-y-2">
            {[
              { icon: AlertTriangle, tone: 'amber', text: `${m.faible.length} produits sous le seuil minimum`, to: '/admin/stock?f=faible', show: m.faible.length > 0 },
              { icon: PackageX, tone: 'rose', text: `${m.rupture.length} produits en rupture`, to: '/admin/stock?f=rupture', show: m.rupture.length > 0 },
              { icon: CalendarClock, tone: 'rose', text: `${new Set(m.exp30.map((l) => l.productId)).size} produits expirent sous 30 jours`, to: '/admin/lots', show: m.exp30.length > 0 },
            ].filter((a) => a.show).map((a) => (
              <Link key={a.text} to={a.to} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-line hover:border-sage-200 hover:bg-ivory transition-colors">
                <span className={cx('size-7 rounded-lg grid place-items-center shrink-0', tones[a.tone])}><a.icon className="size-3.5" aria-hidden /></span>
                <span className="text-[13px] flex-1">{a.text}</span>
                <ArrowRight className="size-4 text-soft group-hover:text-sage-600 group-hover:translate-x-0.5 transition" aria-hidden />
              </Link>
            ))}
            {m.faible.length + m.rupture.length + m.exp30.length === 0 && <p className="text-sm text-muted">Aucune alerte de stock ✨</p>}
          </div>
        </Card>
      </div>

      {/* 2 · À traiter, produits, expirations */}
      <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
        <Card title="À traiter aujourd’hui" subtitle="Commandes, paiements et réceptions en attente">
          {todo.length ? (
            <ul className="space-y-2">
              {todo.map((a) => (
                <li key={a.text}>
                  <Link to={a.to} className="group flex items-center gap-3 p-3 rounded-xl border border-line hover:border-sage-200 hover:bg-ivory transition-colors">
                    <span className={cx('size-9 rounded-xl grid place-items-center shrink-0', tones[a.tone])}><a.icon className="size-4" aria-hidden /></span>
                    <span className="flex-1 min-w-0"><b className="text-lg num mr-1.5">{a.n}</b><span className="text-[13px] text-muted">{a.text}</span></span>
                    <ArrowRight className="size-4 text-soft group-hover:text-sage-600 group-hover:translate-x-0.5 transition" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty title="Tout est à jour" text="Aucune commande ni réception en attente." />}
        </Card>

        <Card title="Produits" action={<Tabs value={productTab} onChange={setProductTab} tabs={[{ id: 'top' as const, label: 'Top ventes' }, { id: 'lent' as const, label: 'Faible rotation' }]} />}>
          <ul className="space-y-3">
            {(productTab === 'top' ? m.top : m.slow).map((t, i) => (
              <li key={t.p.id} className="flex items-center gap-3">
                <span className="w-4 text-xs text-soft num">{i + 1}</span>
                <ProductVisual shape={t.p.shape} color={t.p.color} brand={t.p.brand} className="size-10 rounded-lg shrink-0" />
                <div className="min-w-0 flex-1">
                  <Link to={`/admin/produits/${t.p.id}`} className="block text-[13px] font-medium truncate hover:text-sage-600">{t.p.name}</Link>
                  {productTab === 'top'
                    ? <div className="mt-1 h-1 rounded-full bg-cream overflow-hidden"><Mo.div className="h-full rounded-full bg-sage-400 origin-left" initial={{ scaleX: 0 }} animate={{ scaleX: t.qty / maxQty }} transition={{ duration: 1, ease: EASE, delay: i * 0.05 }} /></div>
                    : <div className="text-[11px] text-muted">{'stock' in t ? `${t.stock} en stock` : ''}</div>}
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-medium num">{t.qty} u.</div>
                  <div className="text-[11px] text-muted num">{money(t.revenue)}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Expirations à venir" subtitle="Lots sous 90 jours, du plus urgent au plus lointain" action={<Link to="/admin/lots" className="text-xs text-sage-600 hover:underline">Tous les lots</Link>} className="lg:col-span-2 xl:col-span-1">
          {m.exp90.length ? (
            <ol className="relative border-l border-line ml-2 space-y-3">
              {m.exp90.slice(0, 6).map((l) => {
                const p = d.products.find((x) => x.id === l.productId)
                const days = daysUntil(l.expiresAt)
                const tone = days < 0 ? 'rose' : days <= 7 ? 'rose' : days <= 30 ? 'amber' : 'gold'
                return (
                  <li key={l.id} className="pl-4 relative">
                    <span className={cx('absolute -left-[5px] top-1.5 size-2.5 rounded-full ring-4 ring-surface', days <= 7 ? 'bg-rose-ink' : days <= 30 ? 'bg-amber-ink' : 'bg-champagne-400')} />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium truncate">{p?.name}</span>
                      <Badge tone={tone}>{days < 0 ? 'Expiré' : `J-${days}`}</Badge>
                    </div>
                    <div className="text-[11px] text-muted num">Lot {l.number} · {l.qty} u. · {d.stores.find((s) => s.id === l.storeId)?.city}</div>
                  </li>
                )
              })}
            </ol>
          ) : <Empty title="Aucune expiration proche" text="Aucun lot n’expire dans les 90 prochains jours." />}
        </Card>
      </div>

      {/* 3 · Activité récente + clients / achats */}
      <div className="grid xl:grid-cols-3 gap-4 mb-4">
        <Card title="Ventes & commandes récentes" padded={false} className="xl:col-span-2" action={<Link to="/admin/ventes" className="text-xs text-sage-600 hover:underline">Journal des ventes</Link>}>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>N°</th><th>Client</th><th>Canal</th><th className="text-right">Montant</th><th>Statut</th><th>Heure</th></tr></thead>
              <tbody>
                {recent.map((o) => {
                  const c = o.customerId ? customers.get(o.customerId) : undefined
                  return (
                    <tr key={o.id}>
                      <td><Link to={`/admin/commandes/${o.id}`} className="font-medium hover:text-sage-600 num">{o.number}</Link></td>
                      <td className="text-muted truncate max-w-40">{c ? `${c.firstName} ${c.lastName}` : 'Client de passage'}</td>
                      <td><Badge tone={o.channel === 'web' ? 'teal' : 'neutral'}>{o.channel === 'web' ? 'En ligne' : 'Boutique'}</Badge></td>
                      <td className="text-right font-semibold num">{money(o.total)}</td>
                      <td><StatusBadge map={ORDER_STATUS} value={o.status} /></td>
                      <td className="text-muted text-xs whitespace-nowrap">{dateTime(o.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="grid sm:grid-cols-2 xl:grid-cols-1 gap-4">
          <Card title={<span className="flex items-center gap-2"><Users className="size-4 text-teal-500" aria-hidden />Clients</span>} action={<Link to="/admin/clients" className="text-xs text-sage-600 hover:underline">CRM</Link>}>
            <dl className="grid grid-cols-3 gap-3">
              <div><dt className="text-[11px] text-muted">Nouveaux</dt><dd className="text-xl font-semibold"><AnimatedNumber value={m.newCustomers} /></dd><dd className="text-[11px]"><Delta value={variation(m.newCustomers, m.newPrev)} /></dd></div>
              <div><dt className="text-[11px] text-muted">Actifs 90 j</dt><dd className="text-xl font-semibold"><AnimatedNumber value={m.active90} /></dd></div>
              <div><dt className="text-[11px] text-muted">Fidélité</dt><dd className="text-xl font-semibold"><AnimatedNumber value={m.loyaltyMembers} /></dd><dd className="text-[11px] text-soft">membres</dd></div>
            </dl>
          </Card>
          <Card title={<span className="flex items-center gap-2"><ShoppingBag className="size-4 text-champagne-600" aria-hidden />Achats</span>} action={<Link to="/admin/achats" className="text-xs text-sage-600 hover:underline">Achats</Link>}>
            <dl className="grid grid-cols-3 gap-3">
              <div><dt className="text-[11px] text-muted">En cours</dt><dd className="text-xl font-semibold"><AnimatedNumber value={m.openPOs.length} /></dd><dd className="text-[11px] text-soft">bons</dd></div>
              <div><dt className="text-[11px] text-muted">À payer</dt><dd className="text-xl font-semibold"><AnimatedNumber value={m.unpaidInvoices.length} /></dd><dd className="text-[11px] text-soft num">{money(sum(m.unpaidInvoices, (p) => p.invoice!.amount))}</dd></div>
              <div><dt className="text-[11px] text-muted">À réappro.</dt><dd className="text-xl font-semibold"><AnimatedNumber value={m.faible.length + m.rupture.length} /></dd><dd className="text-[11px] text-soft">produits</dd></div>
            </dl>
          </Card>
        </div>
      </div>

      {/* 4 · Analyses secondaires regroupées */}
      <Card title="Analyses" subtitle="Tendances sur 12 semaines" action={
        <Tabs value={insight} onChange={setInsight} tabs={[{ id: 'categories', label: 'Catégories' }, { id: 'canaux', label: 'Canaux' }, { id: 'clients', label: 'Clients' }, { id: 'stock', label: 'Stock' }, { id: 'marge', label: 'Marge' }]} />
      }>
        <Mo.div key={insight} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
          {insight === 'categories' && (
            <div className="grid md:grid-cols-[260px_1fr] gap-6 items-center">
              <Donut data={m.catTop} unit="DH" height={220} center={{ value: money(m.ca), label: 'CA période' }} />
              <Legendary items={m.catTop.map((c) => ({ name: c.name, value: money(c.value) }))} />
            </div>
          )}
          {insight === 'canaux' && <Bars data={weekly} x="label" stacked series={[{ key: 'pos', label: 'Boutiques (POS)' }, { key: 'web', label: 'E-commerce', color: 'var(--color-teal-500)' }]} height={280} />}
          {insight === 'clients' && <Bars data={custMix} x="label" stacked series={[{ key: 'existants', label: 'Existants' }, { key: 'nouveaux', label: 'Nouveaux', color: 'var(--color-teal-500)' }]} height={280} />}
          {insight === 'stock' && <TrendChart data={stockTrend} x="label" series={[{ key: 'stock', label: 'Unités en stock', color: 'var(--color-teal-500)' }]} height={280} />}
          {insight === 'marge' && <TrendChart data={weekly} x="label" unit="%" kind="line" series={[{ key: 'tauxMarge', label: 'Taux de marge', color: 'var(--color-champagne-400)' }]} height={280} />}
        </Mo.div>
      </Card>
    </div>
  )
}
