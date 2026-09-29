import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Phone, Printer, Mail } from 'lucide-react'
import { actions, useData } from '../../lib/store'
import { dateTime, money } from '../../lib/format'
import { customerStats } from '../../lib/logic'
import { Badge, Card, Empty, ORDER_STATUS, PageHeader, PAYMENT_STATUS, StatusBadge, toast } from '../../components/ui'
import { ProductVisual } from '../../components/ProductVisual'
import { OrderTimeline } from '../../components/OrderTimeline'

export default function OrderDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const d = useData()
  const o = d.orders.find((x) => x.id === id)
  if (!o) return <Empty title="Commande introuvable" action={<Link className="btn-secondary" to="/admin/commandes">Retour</Link>} />
  const c = d.customers.find((x) => x.id === o.customerId)
  const zone = d.zones.find((z) => z.id === o.delivery?.zoneId)
  const store = d.stores.find((s) => s.id === o.storeId)
  const next = { recue: 'Lancer la préparation', preparation: 'Expédier le colis', expediee: 'Remis au livreur', livraison: 'Confirmer la livraison' }[o.status as string]

  return (
    <div>
      <button onClick={() => nav(-1)} className="btn-ghost btn-sm mb-3 -ml-2"><ArrowLeft className="size-4" /> Retour</button>
      <PageHeader
        eyebrow={o.channel === 'web' ? 'Commande en ligne' : 'Vente en boutique'}
        title={o.number}
        subtitle={`${dateTime(o.createdAt)} · ${store?.name}${o.cashier ? ` · Caisse : ${o.cashier}` : ''}`}
        actions={<>
          <button className="btn-secondary" onClick={() => window.print()}><Printer className="size-4" /> Imprimer</button>
          {(o.status === 'recue' || o.status === 'preparation') && <button className="btn-secondary" onClick={() => { actions.cancelOrder(o.id).then(() => toast('Commande annulée')).catch(() => {}) }}>Annuler</button>}
          {o.payment.status === 'en_attente' && <button className="btn-secondary" onClick={() => { actions.markPaid(o.id).then(() => toast('Paiement enregistré')).catch(() => {}) }}>Marquer payée</button>}
          {next && o.channel === 'web' && <button className="btn-primary" onClick={() => { actions.advanceOrder(o.id).then(() => toast(next)).catch(() => {}) }}>{next}</button>}
        </>}
      />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {o.channel === 'web' && <Card title="Suivi"><div className="pt-2"><OrderTimeline order={o} /></div></Card>}
          <Card title="Articles" padded={false}>
            <ul className="divide-y divide-line">
              {o.items.map((it) => {
                const p = d.products.find((x) => x.id === it.productId)!
                return (
                  <li key={it.productId} className="flex items-center gap-4 px-5 py-3">
                    <ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="size-12 rounded-xl" />
                    <div className="flex-1 min-w-0">
                      <Link to={`/admin/produits/${p.id}`} className="text-sm font-medium hover:text-sage-600">{p.name}</Link>
                      <div className="text-xs text-muted">{p.brand} · {p.ref}</div>
                    </div>
                    <div className="text-sm text-muted tabular-nums">{it.qty} × {money(it.unitPrice, true)}</div>
                    <div className="w-24 text-right text-sm font-medium tabular-nums">{money(it.qty * it.unitPrice, true)}</div>
                  </li>
                )
              })}
            </ul>
            <dl className="px-5 py-4 border-t border-line text-sm space-y-1.5 bg-ivory rounded-b-2xl">
              <div className="flex justify-between"><dt className="text-muted">Sous-total</dt><dd className="tabular-nums">{money(o.subtotal, true)}</dd></div>
              {o.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Remise {o.couponCode && <Badge tone="gold">{o.couponCode}</Badge>}</dt><dd className="tabular-nums text-sage-600">−{money(o.discount, true)}</dd></div>}
              {!!o.pointsUsed && <div className="flex justify-between"><dt className="text-muted">Points fidélité utilisés</dt><dd className="tabular-nums">{o.pointsUsed} pts</dd></div>}
              {o.channel === 'web' && <div className="flex justify-between"><dt className="text-muted">Livraison</dt><dd className="tabular-nums">{o.shipping ? money(o.shipping, true) : 'Offerte'}</dd></div>}
              <div className="flex justify-between text-base font-semibold pt-1"><dt>Total</dt><dd className="tabular-nums">{money(o.total, true)}</dd></div>
            </dl>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Statut">
            <div className="flex flex-wrap gap-2">
              <StatusBadge map={ORDER_STATUS} value={o.status} />
              <StatusBadge map={PAYMENT_STATUS} value={o.payment.status} />
            </div>
            <div className="text-sm text-muted mt-3">Moyen de paiement : <span className="text-ink">{{ carte: 'Carte bancaire', especes: 'Espèces', livraison: 'Paiement à la livraison', virement: 'Virement' }[o.payment.method]}</span></div>
          </Card>
          {c && (
            <Card title="Client" action={<Link to={`/admin/clients/${c.id}`} className="text-xs text-sage-600 hover:underline">Fiche client</Link>}>
              <div className="font-medium">{c.firstName} {c.lastName}</div>
              <div className="text-sm text-muted mt-2 space-y-1">
                <div className="flex items-center gap-2"><Phone className="size-3.5" />{c.phone}</div>
                <div className="flex items-center gap-2"><Mail className="size-3.5" />{c.email}</div>
              </div>
              <div className="mt-3 flex gap-2"><Badge tone="gold">{customerStats(d, c).tier.id}</Badge><Badge>{c.points} pts</Badge></div>
            </Card>
          )}
          {o.delivery && (
            <Card title="Livraison">
              <div className="flex gap-2 text-sm"><MapPin className="size-4 text-soft mt-0.5" /><div>{o.delivery.address}<br />{o.delivery.city}</div></div>
              <div className="text-sm text-muted mt-3 space-y-1">
                <div>Mode : <span className="text-ink">{o.delivery.mode === 'express' ? `Express (${zone?.expressDelay})` : o.delivery.mode === 'retrait' ? 'Retrait en boutique' : `Standard (${zone?.standardDelay})`}</span></div>
                <div>Zone : <span className="text-ink">{zone?.name}</span></div>
                {o.delivery.carrier && <div>Transporteur : <span className="text-ink">{o.delivery.carrier}</span></div>}
                {o.delivery.tracking && <div>Suivi : <span className="text-ink font-mono text-xs">{o.delivery.tracking}</span></div>}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
