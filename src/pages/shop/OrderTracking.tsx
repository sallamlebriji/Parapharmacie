import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, MapPin } from 'lucide-react'
import { actions, useData } from '../../lib/store'
import { dateTime, money } from '../../lib/format'
import { OrderTimeline } from '../../components/OrderTimeline'
import { ProductVisual } from '../../components/ProductVisual'
import { Empty, ORDER_STATUS, PAYMENT_STATUS, StatusBadge } from '../../components/ui'

export default function OrderTracking() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const d = useData()
  const o = d.orders.find((x) => x.id === id)
  // Refresh the status from the server (the order may have progressed in the back-office).
  useEffect(() => { if (id) actions.fetchShopOrder(id).catch(() => {}) }, [id])
  if (!o) return <Empty title="Commande introuvable" text="Connectez-vous au compte qui a passé la commande pour la suivre." action={<Link to="/boutique/compte" className="btn-secondary">Mon compte</Link>} />
  const c = d.customers.find((x) => x.id === o.customerId)
  const zone = d.zones.find((z) => z.id === o.delivery?.zoneId)
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {params.get('confirmation') && (
        <div className="text-center mb-10 animate-fade-up">
          <CheckCircle2 className="size-14 text-sage-500 mx-auto" strokeWidth={1.5} />
          <h1 className="text-3xl md:text-4xl mt-4">Merci {c?.firstName} !</h1>
          <p className="text-muted mt-2">Votre commande <b className="text-ink">{o.number}</b> est confirmée. Un email de confirmation a été envoyé à {c?.email}.</p>
        </div>
      )}
      <div className="card p-6 md:p-8">
        <div className="flex flex-wrap justify-between gap-3 mb-8">
          <div><div className="text-xs text-muted">Commande</div><div className="font-display text-2xl">{o.number}</div><div className="text-xs text-muted">{dateTime(o.createdAt)}</div></div>
          <div className="flex gap-2 items-start"><StatusBadge map={ORDER_STATUS} value={o.status} /><StatusBadge map={PAYMENT_STATUS} value={o.payment.status} /></div>
        </div>
        <OrderTimeline order={o} />
        {o.delivery && (
          <div className="grid sm:grid-cols-2 gap-4 mt-8 text-sm">
            <div className="rounded-xl bg-ivory border border-line p-4"><div className="text-xs text-muted mb-1 flex items-center gap-1"><MapPin className="size-3.5" /> Adresse de livraison</div>{c?.firstName} {c?.lastName}<br />{o.delivery.address}, {o.delivery.city}</div>
            <div className="rounded-xl bg-ivory border border-line p-4"><div className="text-xs text-muted mb-1">Mode</div>{o.delivery.mode === 'express' ? `Express — ${zone?.expressDelay}` : o.delivery.mode === 'retrait' ? 'Retrait en boutique' : `Standard — ${zone?.standardDelay}`}{o.delivery.tracking && <div className="text-xs text-muted mt-1">{o.delivery.carrier} · suivi {o.delivery.tracking}</div>}</div>
          </div>
        )}
        <ul className="divide-y divide-line mt-8 border-t border-line">
          {o.items.map((i) => { const p = d.products.find((x) => x.id === i.productId)!; return (
            <li key={i.productId} className="flex items-center gap-4 py-3"><ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="size-14 rounded-xl" /><div className="flex-1 text-sm">{p.name}<div className="text-xs text-muted">{i.qty} × {money(i.unitPrice, true)}</div></div><div className="text-sm font-medium tabular-nums">{money(i.qty * i.unitPrice, true)}</div></li>
          ) })}
        </ul>
        <div className="border-t border-line pt-4 text-sm space-y-1">
          {o.discount > 0 && <div className="flex justify-between text-sage-600"><span>Réductions</span><span>−{money(o.discount, true)}</span></div>}
          <div className="flex justify-between"><span className="text-muted">Livraison</span><span>{o.shipping ? money(o.shipping, true) : 'Offerte'}</span></div>
          <div className="flex justify-between text-lg font-semibold"><span>Total</span><span>{money(o.total, true)}</span></div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3 mt-8">
        <Link to="/boutique" className="btn-primary">Continuer mes achats</Link>
        <Link to="/boutique/compte" className="btn-secondary">Mes commandes</Link>
        <Link to={`/admin/commandes/${o.id}`} className="btn-ghost">Voir côté back-office (démo) →</Link>
      </div>
    </div>
  )
}
