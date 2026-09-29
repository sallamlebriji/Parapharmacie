import { useState } from 'react'
import { Mail, MapPin, Phone, Plus } from 'lucide-react'
import { useCan, useData } from '../../lib/store'
import { date, money, sum } from '../../lib/format'
import { Avatar, Badge, Card, Modal, PageHeader, PO_STATUS, StatusBadge, Tabs, toast } from '../../components/ui'
import { ProductVisual } from '../../components/ProductVisual'

export default function Suppliers() {
  const d = useData()
  const can = useCan()
  const [open, setOpen] = useState<string | null>(null)
  const [tab, setTab] = useState<'produits' | 'commandes' | 'factures'>('produits')
  const s = d.suppliers.find((x) => x.id === open)
  const poTotal = (supId: string) => sum(d.purchaseOrders.filter((p) => p.supplierId === supId), (p) => sum(p.lines, (l) => l.qty * l.unitCost))

  return (
    <div>
      <PageHeader title="Fournisseurs" subtitle="Vos laboratoires et distributeurs, leurs produits, prix d’achat et historique." actions={<button className="btn-primary" onClick={() => toast('Formulaire fournisseur — à connecter à l’API')}><Plus className="size-4" /> Fournisseur</button>} />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {d.suppliers.map((sup) => {
          const pos = d.purchaseOrders.filter((p) => p.supplierId === sup.id)
          const unpaid = pos.filter((p) => p.invoice && !p.invoice.paid)
          return (
            <button key={sup.id} onClick={() => { setOpen(sup.id); setTab('produits') }} className="card p-5 text-left cursor-pointer transition hover:shadow-lift hover:-translate-y-0.5">
              <div className="flex items-start gap-3">
                <Avatar name={sup.name} className="size-10 text-xs" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{sup.name}</div>
                  <div className="text-xs text-muted flex items-center gap-1 mt-0.5"><MapPin className="size-3" /> {sup.city} · {sup.paymentTerms}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">{sup.brands.map((b) => <Badge key={b} tone="sage">{b}</Badge>)}</div>
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-line text-center">
                <div><div className="font-semibold tabular-nums">{d.products.filter((p) => p.supplierId === sup.id).length}</div><div className="text-[11px] text-muted">Produits</div></div>
                <div><div className="font-semibold tabular-nums">{pos.length}</div><div className="text-[11px] text-muted">Commandes</div></div>
                <div><div className="font-semibold tabular-nums">{money(poTotal(sup.id))}</div><div className="text-[11px] text-muted">Achats</div></div>
              </div>
              {unpaid.length > 0 && <div className="mt-3 text-xs text-amber-ink">{unpaid.length} facture(s) à payer · {money(sum(unpaid, (p) => p.invoice!.amount))}</div>}
            </button>
          )
        })}
      </div>
      {s && (
        <Modal open wide onClose={() => setOpen(null)} title={s.name}>
          <div className="grid sm:grid-cols-3 gap-3 mb-5">
            <Card className="!shadow-none"><div className="text-xs text-muted mb-1">Contact</div><div className="text-sm font-medium">{s.contact}</div></Card>
            <Card className="!shadow-none"><div className="text-xs text-muted mb-1 flex items-center gap-1"><Phone className="size-3" /> Téléphone</div><div className="text-sm">{s.phone}</div></Card>
            <Card className="!shadow-none"><div className="text-xs text-muted mb-1 flex items-center gap-1"><Mail className="size-3" /> Email</div><div className="text-sm truncate">{s.email}</div></Card>
          </div>
          <Tabs className="mb-3" value={tab} onChange={setTab} tabs={[{ id: 'produits', label: 'Produits fournis' }, { id: 'commandes', label: 'Historique commandes' }, { id: 'factures', label: 'Factures' }]} />
          {tab === 'produits' && (
            <table className="table-base">
              <thead><tr><th>Produit</th>{can('prix_achat.view') && <th className="text-right">Prix d’achat</th>}<th className="text-right">Prix de vente</th></tr></thead>
              <tbody>{d.products.filter((p) => p.supplierId === s.id).map((p) => (
                <tr key={p.id}><td><div className="flex items-center gap-2"><ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="size-8 rounded-md" />{p.name}</div></td>{can('prix_achat.view') && <td className="text-right tabular-nums">{money(p.purchasePrice)}</td>}<td className="text-right tabular-nums">{money(p.price)}</td></tr>
              ))}</tbody>
            </table>
          )}
          {tab === 'commandes' && (
            <table className="table-base">
              <thead><tr><th>N°</th><th>Date</th><th className="text-right">Montant</th><th>Statut</th></tr></thead>
              <tbody>{d.purchaseOrders.filter((p) => p.supplierId === s.id).map((p) => (
                <tr key={p.id}><td>{p.number}</td><td className="text-muted">{date(p.createdAt)}</td><td className="text-right tabular-nums">{money(sum(p.lines, (l) => l.qty * l.unitCost))}</td><td><StatusBadge map={PO_STATUS} value={p.status} /></td></tr>
              ))}</tbody>
            </table>
          )}
          {tab === 'factures' && (
            <table className="table-base">
              <thead><tr><th>Facture</th><th>Échéance</th><th className="text-right">Montant</th><th>Statut</th></tr></thead>
              <tbody>{d.purchaseOrders.filter((p) => p.supplierId === s.id && p.invoice).map((p) => (
                <tr key={p.id}><td className="font-mono text-xs">{p.invoice!.number}</td><td className="text-muted">{date(p.invoice!.dueAt)}</td><td className="text-right tabular-nums">{money(p.invoice!.amount)}</td><td><Badge tone={p.invoice!.paid ? 'sage' : 'amber'} dot>{p.invoice!.paid ? 'Payée' : 'À payer'}</Badge></td></tr>
              ))}</tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  )
}
