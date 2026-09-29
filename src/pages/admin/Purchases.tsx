import { useMemo, useState } from 'react'
import { PackageCheck, Plus, Send, Sparkles, Trash2 } from 'lucide-react'
import { actions, useData, useSession } from '../../lib/store'
import { date, daysFromNow, iso, money, sum, uid } from '../../lib/format'
import { stockIndex } from '../../lib/logic'
import { Badge, Card, Empty, Field, Modal, PageHeader, PO_STATUS, Stat, StatusBadge, Tabs, toast } from '../../components/ui'
import type { PurchaseLine, PurchaseOrder } from '../../lib/types'

export default function Purchases() {
  const d = useData()
  const [tab, setTab] = useState<'bons' | 'receptions' | 'factures'>('bons')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<PurchaseOrder | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [receiving, setReceiving] = useState<string | null>(null)
  const sup = (id: string) => d.suppliers.find((s) => s.id === id)!
  const pos = [...d.purchaseOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const total = (po: PurchaseOrder) => sum(po.lines, (l) => l.qty * l.unitCost)
  const invoices = pos.filter((p) => p.invoice)

  const newPO = () => setEditing({ id: uid('po'), number: `BC-2026-${String(140 + d.purchaseOrders.length).padStart(4, '0')}`, supplierId: d.suppliers[0].id, storeId: d.stores[0].id, status: 'brouillon', lines: [], createdAt: iso(new Date()), expectedAt: iso(daysFromNow(5)) })

  return (
    <div>
      <PageHeader title="Achats" subtitle="Bons de commande, réceptions et factures fournisseurs. Le stock est mis à jour automatiquement à la réception." actions={<button className="btn-primary" onClick={newPO}><Plus className="size-4" /> Bon de commande</button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Commandes en cours" value={pos.filter((p) => p.status === 'envoyee' || p.status === 'partielle').length} tone="sky" />
        <Stat label="Montant engagé" value={money(sum(pos.filter((p) => p.status !== 'recue' && p.status !== 'brouillon'), total))} />
        <Stat label="Factures à payer" value={money(sum(invoices.filter((p) => !p.invoice!.paid), (p) => p.invoice!.amount))} tone="amber" />
        <Stat label="Achats 60 jours" value={money(sum(pos.filter((p) => Date.now() - new Date(p.createdAt).getTime() < 60 * 864e5), total))} tone="gold" />
      </div>
      <div className="flex flex-wrap gap-3 mb-3">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'bons', label: 'Bons de commande' }, { id: 'receptions', label: 'Réceptions' }, { id: 'factures', label: 'Factures fournisseurs' }]} />
        {tab === 'bons' && <Tabs value={status} onChange={setStatus} tabs={[{ id: '', label: 'Tous' }, ...Object.entries(PO_STATUS).map(([k, v]) => ({ id: k, label: v.label, count: pos.filter((p) => p.status === k).length }))]} />}
      </div>
      <Card padded={false}>
        {tab === 'bons' && (
          <table className="table-base">
            <thead><tr><th>N°</th><th>Fournisseur</th><th>Boutique</th><th>Créé le</th><th>Livraison prévue</th><th className="text-right">Montant</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {pos.filter((p) => !status || p.status === status).map((po) => (
                <tr key={po.id} className="cursor-pointer" onClick={() => setViewing(po.id)}>
                  <td className="font-medium">{po.number}</td>
                  <td>{sup(po.supplierId).name}</td>
                  <td className="text-muted">{d.stores.find((s) => s.id === po.storeId)?.city}</td>
                  <td className="text-muted">{date(po.createdAt)}</td>
                  <td className="text-muted">{date(po.expectedAt)}</td>
                  <td className="text-right tabular-nums font-medium">{money(total(po))}</td>
                  <td><StatusBadge map={PO_STATUS} value={po.status} /></td>
                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                    {po.status === 'brouillon' && <button className="btn-secondary btn-sm" onClick={() => { actions.savePO({ ...po, status: 'envoyee' }).then(() => toast(`${po.number} envoyé à ${sup(po.supplierId).name}`)).catch(() => {}) }}><Send className="size-3.5" /> Envoyer</button>}
                    {(po.status === 'envoyee' || po.status === 'partielle') && <button className="btn-primary btn-sm" onClick={() => setReceiving(po.id)}><PackageCheck className="size-3.5" /> Réceptionner</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'receptions' && (
          <table className="table-base">
            <thead><tr><th>Bon</th><th>Produit</th><th className="text-right">Commandé</th><th className="text-right">Reçu</th><th>Lot</th><th>Expiration</th><th className="text-right">Prix d’achat</th></tr></thead>
            <tbody>
              {pos.flatMap((po) => po.lines.filter((l) => l.received > 0).map((l, i) => (
                <tr key={po.id + i}>
                  <td className="font-medium">{po.number}</td>
                  <td>{d.products.find((p) => p.id === l.productId)?.name}</td>
                  <td className="text-right tabular-nums">{l.qty}</td>
                  <td className="text-right tabular-nums">{l.received} {l.received < l.qty && <Badge tone="amber">partiel</Badge>}</td>
                  <td className="font-mono text-xs">{l.lotNumber}</td>
                  <td className="text-muted">{l.expiresAt && date(l.expiresAt)}</td>
                  <td className="text-right tabular-nums">{money(l.unitCost)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        )}
        {tab === 'factures' && (invoices.length === 0 ? <Empty title="Aucune facture" /> : (
          <table className="table-base">
            <thead><tr><th>Facture</th><th>Fournisseur</th><th>Bon</th><th>Échéance</th><th className="text-right">Montant</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {invoices.map((po) => (
                <tr key={po.id}>
                  <td className="font-mono text-xs">{po.invoice!.number}</td>
                  <td>{sup(po.supplierId).name}</td>
                  <td>{po.number}</td>
                  <td className="text-muted">{date(po.invoice!.dueAt)} <span className="text-[11px]">({sup(po.supplierId).paymentTerms})</span></td>
                  <td className="text-right tabular-nums font-medium">{money(po.invoice!.amount)}</td>
                  <td><Badge tone={po.invoice!.paid ? 'sage' : 'amber'} dot>{po.invoice!.paid ? 'Payée' : 'À payer'}</Badge></td>
                  <td className="text-right">{!po.invoice!.paid && <button className="btn-secondary btn-sm" onClick={() => { actions.payInvoice(po.id).then(() => toast('Facture marquée payée')).catch(() => {}) }}>Marquer payée</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </Card>
      {editing && <POEditor po={editing} onClose={() => setEditing(null)} />}
      {viewing && <POView id={viewing} onClose={() => setViewing(null)} onReceive={() => { setReceiving(viewing); setViewing(null) }} />}
      {receiving && <ReceiveModal id={receiving} onClose={() => setReceiving(null)} />}
    </div>
  )
}

function POEditor({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const d = useData()
  const { scope } = useSession()
  const [f, setF] = useState(po)
  const products = d.products.filter((p) => p.supplierId === f.supplierId)
  const idx = useMemo(() => stockIndex(d, f.storeId), [d, f.storeId])
  const setLine = (i: number, l: Partial<PurchaseLine>) => setF({ ...f, lines: f.lines.map((x, j) => (j === i ? { ...x, ...l } : x)) })
  const suggest = () => {
    // Replenish up to 3× the alert threshold for items at or under the threshold.
    const lines = products.filter((p) => idx(p).state !== 'ok').map((p) => ({ productId: p.id, qty: Math.max(6, p.alertThreshold * 3 - idx(p).available), received: 0, unitCost: p.purchasePrice }))
    setF({ ...f, lines: lines.length ? lines : f.lines })
    toast(lines.length ? `${lines.length} produit(s) à réapprovisionner ajoutés` : 'Aucun produit sous le seuil chez ce fournisseur')
  }
  const save = (status: PurchaseOrder['status']) => { actions.savePO({ ...f, status, lines: f.lines.filter((l) => l.qty > 0) }).then(() => toast(status === 'envoyee' ? 'Bon de commande envoyé' : 'Brouillon enregistré')).catch(() => {}); onClose() }
  return (
    <Modal open wide onClose={onClose} title={`Bon de commande ${f.number}`} footer={<>
      <button className="btn-secondary" onClick={() => save('brouillon')}>Enregistrer le brouillon</button>
      <button className="btn-primary" disabled={!f.lines.length} onClick={() => save('envoyee')}><Send className="size-4" /> Envoyer au fournisseur</button>
    </>}>
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <Field label="Fournisseur"><select className="input" value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value, lines: [] })}>{d.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Livrer à"><select className="input" value={f.storeId} onChange={(e) => setF({ ...f, storeId: e.target.value })}>{d.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Livraison prévue"><input type="date" className="input" value={f.expectedAt.slice(0, 10)} onChange={(e) => setF({ ...f, expectedAt: iso(new Date(e.target.value)) })} /></Field>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Lignes</span>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" onClick={suggest}><Sparkles className="size-3.5" /> Réappro. suggéré</button>
          <button className="btn-secondary btn-sm" onClick={() => products[0] && setF({ ...f, lines: [...f.lines, { productId: products[0].id, qty: 12, received: 0, unitCost: products[0].purchasePrice }] })}><Plus className="size-3.5" /> Ligne</button>
        </div>
      </div>
      {f.lines.length === 0 ? <p className="text-sm text-muted py-6 text-center border border-dashed border-line rounded-xl">Ajoutez des produits ou utilisez la suggestion de réapprovisionnement{scope !== 'all' ? '' : ''}.</p> : (
        <div className="space-y-2">
          {f.lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <select className="input col-span-6" value={l.productId} onChange={(e) => { const p = products.find((x) => x.id === e.target.value)!; setLine(i, { productId: p.id, unitCost: p.purchasePrice }) }}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <input type="number" className="input col-span-2" value={l.qty} onChange={(e) => setLine(i, { qty: +e.target.value })} aria-label="Quantité" />
              <input type="number" className="input col-span-2" value={l.unitCost} onChange={(e) => setLine(i, { unitCost: +e.target.value })} aria-label="Prix unitaire" />
              <span className="col-span-1 text-right text-xs tabular-nums">{money(l.qty * l.unitCost)}</span>
              <button className="btn-ghost h-8 w-8 p-0 col-span-1" onClick={() => setF({ ...f, lines: f.lines.filter((_, j) => j !== i) })} aria-label="Supprimer"><Trash2 className="size-4" /></button>
            </div>
          ))}
          <div className="text-right text-sm font-semibold pt-2">Total HT : {money(sum(f.lines, (l) => l.qty * l.unitCost))}</div>
        </div>
      )}
    </Modal>
  )
}

function POView({ id, onClose, onReceive }: { id: string; onClose: () => void; onReceive: () => void }) {
  const d = useData()
  const po = d.purchaseOrders.find((p) => p.id === id)!
  const s = d.suppliers.find((x) => x.id === po.supplierId)!
  return (
    <Modal open wide onClose={onClose} title={po.number} footer={(po.status === 'envoyee' || po.status === 'partielle') && <button className="btn-primary" onClick={onReceive}><PackageCheck className="size-4" /> Réceptionner</button>}>
      <div className="flex flex-wrap gap-6 text-sm mb-4">
        <div><div className="text-xs text-muted">Fournisseur</div>{s.name}</div>
        <div><div className="text-xs text-muted">Contact</div>{s.contact} · {s.phone}</div>
        <div><div className="text-xs text-muted">Statut</div><StatusBadge map={PO_STATUS} value={po.status} /></div>
      </div>
      <table className="table-base">
        <thead><tr><th>Produit</th><th className="text-right">Qté</th><th className="text-right">Reçu</th><th className="text-right">PU</th><th className="text-right">Total</th></tr></thead>
        <tbody>{po.lines.map((l, i) => <tr key={i}><td>{d.products.find((p) => p.id === l.productId)?.name}</td><td className="text-right">{l.qty}</td><td className="text-right">{l.received}</td><td className="text-right">{money(l.unitCost)}</td><td className="text-right">{money(l.qty * l.unitCost)}</td></tr>)}</tbody>
      </table>
    </Modal>
  )
}

function ReceiveModal({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useData()
  const po = d.purchaseOrders.find((p) => p.id === id)!
  const [rows, setRows] = useState(po.lines.map((l, i) => ({ index: i, qty: l.qty - l.received, lotNumber: `L${Math.floor(Math.random() * 90000 + 10000)}`, expiresAt: iso(daysFromNow(540)).slice(0, 10) })))
  const submit = () => { actions.receivePO(po.id, rows).then(() => toast(`Réception enregistrée — stock mis à jour (+${sum(rows, (r) => r.qty)} u.)`)).catch(() => {}); onClose() }
  return (
    <Modal open wide onClose={onClose} title={`Réception — ${po.number}`} footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button><button className="btn-primary" onClick={submit}>Valider la réception</button></>}>
      <p className="text-sm text-muted mb-4">Saisissez les quantités reçues, le numéro de lot et la date d’expiration. Une réception partielle laisse le bon ouvert.</p>
      <div className="space-y-3">
        {po.lines.map((l, i) => {
          const p = d.products.find((x) => x.id === l.productId)!
          const r = rows[i]
          const upd = (x: Partial<typeof r>) => setRows(rows.map((y, j) => (j === i ? { ...y, ...x } : y)))
          return (
            <div key={i} className="rounded-xl border border-line p-3">
              <div className="flex justify-between text-sm mb-2"><span className="font-medium">{p.name}</span><span className="text-muted">Reste : {l.qty - l.received}</span></div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Qté reçue"><input type="number" className="input" value={r.qty} max={l.qty - l.received} onChange={(e) => upd({ qty: Math.max(0, Math.min(l.qty - l.received, +e.target.value)) })} /></Field>
                <Field label="N° de lot"><input className="input font-mono" value={r.lotNumber} onChange={(e) => upd({ lotNumber: e.target.value })} /></Field>
                <Field label="Expiration"><input type="date" className="input" value={r.expiresAt} onChange={(e) => upd({ expiresAt: e.target.value })} /></Field>
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
