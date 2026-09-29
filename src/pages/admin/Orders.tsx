import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Search } from 'lucide-react'
import { actions, useData, useSession } from '../../lib/store'
import { dateTime, money, sum } from '../../lib/format'
import { Badge, Card, Empty, ORDER_STATUS, PageHeader, PAYMENT_STATUS, StatusBadge, Tabs, toast } from '../../components/ui'
import type { OrderStatus } from '../../lib/types'

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = { recue: 'Préparer', preparation: 'Expédier', expediee: 'En livraison', livraison: 'Marquer livrée' }

export default function Orders() {
  const d = useData()
  const { scope } = useSession()
  const [params, setParams] = useSearchParams()
  const status = (params.get('s') ?? 'actives') as OrderStatus | 'actives' | 'toutes'
  const payFilter = params.get('p')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const customers = useMemo(() => new Map(d.customers.map((c) => [c.id, c])), [d.customers])

  const web = useMemo(() => d.orders.filter((o) => o.channel === 'web' && (scope === 'all' || o.storeId === scope)), [d.orders, scope])
  const count = (s: OrderStatus) => web.filter((o) => o.status === s).length
  const list = web
    .filter((o) => status === 'toutes' || (status === 'actives' ? ['recue', 'preparation', 'expediee', 'livraison'].includes(o.status) : o.status === status))
    .filter((o) => !payFilter || o.payment.status === payFilter)
    .filter((o) => { if (!q) return true; const c = o.customerId ? customers.get(o.customerId) : undefined; return `${o.number} ${c?.firstName} ${c?.lastName} ${c?.phone}`.toLowerCase().includes(q.toLowerCase()) })
    .slice(0, 150)

  const setStatus = (s: string) => { setSelected([]); setParams(s === 'actives' ? {} : { s }) }
  const bulk = () => { selected.forEach((id) => actions.advanceOrder(id)); toast(`${selected.length} commande(s) avancée(s)`); setSelected([]) }

  return (
    <div>
      <PageHeader title="Commandes en ligne" subtitle="Préparez, expédiez et suivez chaque commande jusqu’à la livraison." />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Tabs value={status} onChange={setStatus} tabs={[
          { id: 'actives', label: 'En cours', count: web.filter((o) => ['recue', 'preparation', 'expediee', 'livraison'].includes(o.status)).length },
          { id: 'recue', label: 'Reçues', count: count('recue') },
          { id: 'preparation', label: 'Préparation', count: count('preparation') },
          { id: 'expediee', label: 'Expédiées', count: count('expediee') },
          { id: 'livraison', label: 'En livraison', count: count('livraison') },
          { id: 'livree', label: 'Livrées' },
          { id: 'annulee', label: 'Annulées' },
          { id: 'toutes', label: 'Toutes' },
        ]} />
        {payFilter && <Badge tone="amber">Paiement en attente <button className="ml-1 cursor-pointer" onClick={() => setParams({})}>×</button></Badge>}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-soft" />
          <input className="input pl-9" placeholder="N°, client, téléphone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {selected.length > 0 && (
        <div className="card flex items-center justify-between px-4 py-2.5 mb-3 bg-sage-50 border-sage-200 animate-fade-up">
          <span className="text-sm">{selected.length} sélectionnée(s)</span>
          <button className="btn-primary btn-sm" onClick={bulk}>Passer à l’étape suivante</button>
        </div>
      )}
      <Card padded={false}>
        {list.length === 0 ? <Empty title="Aucune commande" text="Aucune commande ne correspond à ces critères." /> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr>
                <th className="w-8"><input type="checkbox" aria-label="Tout sélectionner" checked={selected.length > 0 && selected.length === list.filter((o) => NEXT_LABEL[o.status]).length} onChange={(e) => setSelected(e.target.checked ? list.filter((o) => NEXT_LABEL[o.status]).map((o) => o.id) : [])} /></th>
                <th>Commande</th><th>Client</th><th>Livraison</th><th className="text-right">Total</th><th>Paiement</th><th>Statut</th><th></th>
              </tr></thead>
              <tbody>
                {list.map((o) => {
                  const c = o.customerId ? customers.get(o.customerId) : undefined
                  return (
                    <tr key={o.id}>
                      <td><input type="checkbox" aria-label={`Sélectionner ${o.number}`} disabled={!NEXT_LABEL[o.status]} checked={selected.includes(o.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, o.id] : selected.filter((x) => x !== o.id))} /></td>
                      <td>
                        <Link to={`/admin/commandes/${o.id}`} className="font-medium hover:text-sage-600">{o.number}</Link>
                        <div className="text-[11px] text-muted">{dateTime(o.createdAt)} · {sum(o.items, (i) => i.qty)} article(s)</div>
                      </td>
                      <td>{c ? <><div>{c.firstName} {c.lastName}</div><div className="text-[11px] text-muted">{c.phone}</div></> : '—'}</td>
                      <td className="whitespace-nowrap">
                        <div className="text-[13px]">{o.delivery?.city}</div>
                        <div className="text-[11px] text-muted">{o.delivery?.mode === 'express' ? '⚡ Express' : o.delivery?.mode === 'retrait' ? 'Retrait boutique' : 'Standard'}</div>
                      </td>
                      <td className="text-right tabular-nums font-medium">{money(o.total)}</td>
                      <td><StatusBadge map={PAYMENT_STATUS} value={o.payment.status} /></td>
                      <td><StatusBadge map={ORDER_STATUS} value={o.status} /></td>
                      <td className="text-right whitespace-nowrap">
                        {NEXT_LABEL[o.status] && <button className="btn-secondary btn-sm mr-1" onClick={() => { actions.advanceOrder(o.id).then(() => toast(`${o.number} : ${NEXT_LABEL[o.status]}`)).catch(() => {}) }}>{NEXT_LABEL[o.status]}</button>}
                        <Link to={`/admin/commandes/${o.id}`} className="btn-ghost btn-sm px-2" aria-label="Détail"><ChevronRight className="size-4" /></Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
