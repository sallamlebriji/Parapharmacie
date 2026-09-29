import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { actions, useData, useSession } from '../../lib/store'
import { CATEGORY_LABEL } from '../../data/plans'
import { date, money, pct, sum } from '../../lib/format'
import { productSales, validOrders } from '../../lib/logic'
import { bucketKey, buckets, bucketLabel } from '../../lib/series'
import { Card, Field, Modal, PageHeader, Stat, Tabs, cx, toast } from '../../components/ui'
import { Bars } from '../../components/charts'

export default function Finance() {
  const d = useData()
  const { scope } = useSession()
  const [period, setPeriod] = useState<'mois' | '6mois'>('6mois')
  const [add, setAdd] = useState(false)
  const [exp, setExp] = useState({ label: '', category: 'Charges', amount: 0, storeId: d.stores[0].id })

  const m = useMemo(() => {
    const keys = buckets('mois', 6)
    const since = period === 'mois' ? keys[5] : keys[0]
    const orders = validOrders(d, scope).filter((o) => new Date(o.createdAt).getTime() >= since)
    const allOrders = d.orders.filter((o) => (scope === 'all' || o.storeId === scope) && new Date(o.createdAt).getTime() >= since)
    const expenses = d.expenses.filter((e) => (scope === 'all' || e.storeId === scope) && new Date(e.date).getTime() >= since)
    const purchases = d.purchaseOrders.filter((p) => (scope === 'all' || p.storeId === scope) && p.invoice && new Date(p.createdAt).getTime() >= since)
    const ca = sum(orders.filter((o) => o.total > 0), (o) => o.total - o.shipping)
    const refunds = -sum(allOrders.filter((o) => o.total < 0), (o) => o.total) + sum(allOrders.filter((o) => o.status === 'annulee' && o.payment.status === 'rembourse'), (o) => o.total)
    const cogs = sum(orders, (o) => sum(o.items, (i) => i.unitCost * i.qty))
    const discounts = sum(orders, (o) => o.discount)
    const gross = ca - cogs
    const opex = sum(expenses, (e) => e.amount)
    const monthly = keys.map((k) => {
      const os = validOrders(d, scope).filter((o) => bucketKey(new Date(o.createdAt), 'mois') === k)
      const rev = sum(os, (o) => o.total - o.shipping)
      const cost = sum(os, (o) => sum(o.items, (i) => i.unitCost * i.qty))
      const ex = sum(d.expenses.filter((e) => (scope === 'all' || e.storeId === scope) && bucketKey(new Date(e.date), 'mois') === k), (e) => e.amount)
      return { label: bucketLabel(k, 'mois'), ca: Math.round(rev), cout: Math.round(cost), depenses: Math.round(ex), benefice: Math.round(rev - cost - ex) }
    })
    const cats = new Map<string, { ca: number; marge: number }>()
    orders.forEach((o) => o.items.forEach((i) => { const p = d.products.find((x) => x.id === i.productId)!; const c = cats.get(p.category) ?? { ca: 0, marge: 0 }; c.ca += i.qty * i.unitPrice; c.marge += i.qty * (i.unitPrice - i.unitCost); cats.set(p.category, c) }))
    const byMethod = ['carte', 'especes', 'livraison'].map((k) => ({ k, v: sum(orders.filter((o) => o.payment.method === k && o.payment.status === 'paye'), (o) => o.total) }))
    const pending = sum(orders.filter((o) => o.payment.status === 'en_attente'), (o) => o.total)
    return { ca, refunds, cogs, discounts, gross, opex, net: gross - opex, monthly, cats, byMethod, pending, expenses, purchases, sales: productSales(orders) }
  }, [d, scope, period])

  return (
    <div>
      <PageHeader title="Finance" subtitle="Chiffre d’affaires, coûts, marges et bénéfice estimé." actions={<>
        <Tabs value={period} onChange={setPeriod} tabs={[{ id: 'mois', label: 'Mois en cours' }, { id: '6mois', label: '6 mois' }]} />
        <button className="btn-primary" onClick={() => setAdd(true)}><Plus className="size-4" /> Dépense</button>
      </>} />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        <Stat label="Chiffre d’affaires" value={money(m.ca)} />
        <Stat label="Coût des marchandises" value={money(m.cogs)} tone="neutral" />
        <Stat label="Marge brute" value={money(m.gross)} hint={pct((m.gross / (m.ca || 1)) * 100)} tone="gold" />
        <Stat label="Dépenses" value={money(m.opex)} tone="rose" />
        <Stat label="Bénéfice estimé" value={money(m.net)} hint={pct((m.net / (m.ca || 1)) * 100)} tone="sage" />
        <Stat label="Remboursements" value={money(m.refunds)} tone="amber" />
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="Résultat mensuel" className="lg:col-span-2">
          <Bars data={m.monthly} x="label" unit="DH" series={[{ key: 'ca', label: 'CA' }, { key: 'cout', label: 'Coût marchandises', color: '#d4b98c' }, { key: 'depenses', label: 'Dépenses', color: '#c98a7f' }, { key: 'benefice', label: 'Bénéfice', color: 'var(--color-sage-700)' }]} height={300} />
        </Card>
        <Card title="Paiements">
          <ul className="space-y-3 text-sm">
            {m.byMethod.map((x) => <li key={x.k} className="flex justify-between"><span className="text-muted">{{ carte: 'Carte bancaire', especes: 'Espèces', livraison: 'Paiement à la livraison' }[x.k]}</span><span className="font-medium tabular-nums">{money(x.v)}</span></li>)}
            <li className="flex justify-between pt-3 border-t border-line"><span className="text-amber-ink">En attente d’encaissement</span><span className="font-medium tabular-nums">{money(m.pending)}</span></li>
            <li className="flex justify-between"><span className="text-muted">Remises accordées</span><span className="tabular-nums">{money(m.discounts)}</span></li>
            <li className="flex justify-between"><span className="text-muted">Factures fournisseurs</span><span className="tabular-nums">{money(sum(m.purchases, (p) => p.invoice!.amount))}</span></li>
            <li className="flex justify-between"><span className="text-muted">dont non payées</span><span className="tabular-nums text-amber-ink">{money(sum(m.purchases.filter((p) => !p.invoice!.paid), (p) => p.invoice!.amount))}</span></li>
          </ul>
        </Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Performance par catégorie" padded={false}>
          <table className="table-base">
            <thead><tr><th>Catégorie</th><th className="text-right">CA</th><th className="text-right">Marge</th><th className="text-right">Taux</th></tr></thead>
            <tbody>{[...m.cats.entries()].sort((a, b) => b[1].ca - a[1].ca).map(([k, v]) => (
              <tr key={k}><td>{CATEGORY_LABEL[k]}</td><td className="text-right tabular-nums">{money(v.ca)}</td><td className="text-right tabular-nums">{money(v.marge)}</td><td className="text-right tabular-nums">{pct((v.marge / v.ca) * 100, 0)}</td></tr>
            ))}</tbody>
          </table>
        </Card>
        <div className="space-y-4">
          <Card title="Performance par produit (top 8)" padded={false}>
            <table className="table-base">
              <thead><tr><th>Produit</th><th className="text-right">CA</th><th className="text-right">Marge</th></tr></thead>
              <tbody>{[...m.sales.entries()].sort((a, b) => b[1].margin - a[1].margin).slice(0, 8).map(([id, v]) => (
                <tr key={id}><td className="truncate max-w-64">{d.products.find((p) => p.id === id)?.name}</td><td className="text-right tabular-nums">{money(v.revenue)}</td><td className="text-right tabular-nums">{money(v.margin)}</td></tr>
              ))}</tbody>
            </table>
          </Card>
          <Card title="Dernières dépenses" padded={false}>
            <table className="table-base">
              <tbody>{[...m.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((e) => (
                <tr key={e.id}><td className="text-muted">{date(e.date)}</td><td>{e.label}</td><td className="text-muted text-xs">{d.stores.find((s) => s.id === e.storeId)?.city}</td><td className={cx('text-right tabular-nums')}>{money(e.amount)}</td></tr>
              ))}</tbody>
            </table>
          </Card>
        </div>
      </div>
      <Modal open={add} onClose={() => setAdd(false)} title="Nouvelle dépense" footer={<><button className="btn-secondary" onClick={() => setAdd(false)}>Annuler</button><button className="btn-primary" onClick={() => { actions.addExpense(exp.label || exp.category, exp.category, exp.amount, exp.storeId).then(() => toast('Dépense enregistrée')).catch(() => {}); setAdd(false) }}>Enregistrer</button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Libellé" className="col-span-2"><input className="input" value={exp.label} onChange={(e) => setExp({ ...exp, label: e.target.value })} /></Field>
          <Field label="Catégorie"><select className="input" value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })}>{['Loyer', 'Salaires', 'Charges', 'Marketing', 'Logiciels', 'Transport', 'Autre'].map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Montant (DH)"><input type="number" className="input" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: +e.target.value })} /></Field>
          <Field label="Boutique" className="col-span-2"><select className="input" value={exp.storeId} onChange={(e) => setExp({ ...exp, storeId: e.target.value })}>{d.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        </div>
      </Modal>
    </div>
  )
}
