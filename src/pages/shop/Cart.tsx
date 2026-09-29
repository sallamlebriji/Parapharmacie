import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, ShoppingBag, Tag, Trash2, Truck } from 'lucide-react'
import { actions, useData, useShop, useShopCustomer, useTenant } from '../../lib/store'
import { money } from '../../lib/format'
import { complementary, computeCart } from '../../lib/logic'
import { ProductVisual } from '../../components/ProductVisual'
import { Empty, Progress, toast } from '../../components/ui'
import { ProductCard } from '../../components/ProductCard'

export function Summary({ cart, children }: { cart: ReturnType<typeof computeCart>; children?: React.ReactNode }) {
  return (
    <div className="card p-6 space-y-2.5 text-sm">
      <div className="flex justify-between"><span className="text-muted">Sous-total ({cart.count} article{cart.count > 1 ? 's' : ''})</span><span className="tabular-nums">{money(cart.subtotal, true)}</span></div>
      {cart.savings > 0 && <div className="flex justify-between text-sage-600"><span>Dont économies promotions</span><span className="tabular-nums">{money(cart.savings, true)}</span></div>}
      {cart.bxgy > 0 && <div className="flex justify-between text-sage-600"><span>{cart.bxgyLabels.join(', ')}</span><span className="tabular-nums">−{money(cart.bxgy, true)}</span></div>}
      {cart.couponDiscount > 0 && <div className="flex justify-between text-sage-600"><span>Code {cart.couponPromo?.code}</span><span className="tabular-nums">−{money(cart.couponDiscount, true)}</span></div>}
      {cart.pointsDiscount > 0 && <div className="flex justify-between text-sage-600"><span>Points fidélité ({cart.pointsUsed})</span><span className="tabular-nums">−{money(cart.pointsDiscount, true)}</span></div>}
      <div className="flex justify-between"><span className="text-muted">Livraison {cart.mode === 'express' ? 'express' : cart.mode === 'retrait' ? '(retrait boutique)' : 'standard'}</span><span className="tabular-nums">{cart.shipping ? money(cart.shipping, true) : 'Offerte'}</span></div>
      <div className="flex justify-between text-lg font-semibold pt-3 border-t border-line"><span>Total TTC</span><span className="tabular-nums">{money(cart.total, true)}</span></div>
      <div className="text-xs text-champagne-600">Vous gagnerez {cart.pointsEarned} points fidélité avec cette commande.</div>
      {children}
    </div>
  )
}

export default function Cart() {
  const d = useData()
  const t = useTenant()
  const shop = useShop()
  const me = useShopCustomer()
  const nav = useNavigate()
  const [code, setCode] = useState(shop.coupon)
  const cart = computeCart(d, t, shop.cart, { coupon: shop.coupon, customer: me?.customer, zoneId: d.zones.find((z) => me && z.cities.includes(me.customer.city))?.id })
  const first = cart.rows.find((r) => r.product)?.product
  const cross = first ? complementary(d, first, 4).filter((p) => !shop.cart.some((l) => l.kind === 'product' && l.productId === p.id)).slice(0, 4) : []

  if (!shop.cart.length) return <div className="max-w-3xl mx-auto px-4 py-16"><Empty icon={<ShoppingBag className="size-5" />} title="Votre panier est vide" text="Découvrez nos routines et nos meilleures ventes." action={<Link to="/boutique/catalogue" className="btn-primary">Continuer mes achats</Link>} /></div>

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl md:text-4xl mb-6">Mon panier</h1>
      <div className="grid lg:grid-cols-[1fr_380px] gap-8">
        <div>
          <div className="card p-4 mb-4 flex items-center gap-3">
            <Truck className="size-5 text-sage-500 shrink-0" />
            <div className="flex-1">
              <div className="text-sm">{cart.freeShipping ? <b className="text-sage-700">Livraison offerte !</b> : <>Plus que <b>{money(cart.remainingForFree)}</b> pour la livraison offerte</>}</div>
              <Progress className="mt-2" value={cart.freeShipping ? 100 : ((cart.zone.freeAbove - cart.remainingForFree) / cart.zone.freeAbove) * 100} />
            </div>
          </div>
          <ul className="card divide-y divide-line">
            {cart.rows.map((r, i) => (
              <li key={r.key} className="flex gap-4 p-4">
                {r.product ? <Link to={`/boutique/produit/${r.product.id}`}><ProductVisual shape={r.product.shape} color={r.product.color} brand={r.product.brand} className="size-24 rounded-xl border border-line" /></Link>
                  : <div className="size-24 rounded-xl border border-line bg-sage-50 grid grid-cols-2 p-1 gap-0.5">{r.pack!.productIds.slice(0, 4).map((id) => { const p = d.products.find((x) => x.id === id)!; return <ProductVisual key={id} shape={p.shape} color={p.color} brand="" bg={false} className="w-full" /> })}</div>}
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-wider text-champagne-600">{r.pack ? 'Pack routine' : r.sub}</div>
                  <div className="font-medium">{r.name}</div>
                  {r.pack && <div className="text-xs text-muted">{r.pack.steps.join(' + ')}</div>}
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center rounded-lg border border-line">
                      <button className="h-8 w-8 grid place-items-center cursor-pointer" onClick={() => actions.setCartQty(i, r.line.qty - 1)} aria-label="Moins"><Minus className="size-3.5" /></button>
                      <span className="w-6 text-center text-sm tabular-nums">{r.line.qty}</span>
                      <button className="h-8 w-8 grid place-items-center cursor-pointer" onClick={() => actions.setCartQty(i, r.line.qty + 1)} aria-label="Plus"><Plus className="size-3.5" /></button>
                    </div>
                    <button className="text-xs text-muted hover:text-rose-ink flex items-center gap-1 cursor-pointer" onClick={() => actions.setCartQty(i, 0)}><Trash2 className="size-3.5" /> Retirer</button>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{money(r.total, true)}</div>
                  {r.old && <div className="text-xs text-soft line-through tabular-nums">{money(r.old * r.line.qty, true)}</div>}
                  <div className="text-[11px] text-muted">{money(r.unit, true)} / u.</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4 lg:sticky lg:top-32 self-start">
          <form className="card p-4" onSubmit={(e) => { e.preventDefault(); actions.setCoupon(code).then(() => toast(code ? 'Code appliqué' : 'Code retiré')).catch(() => {}) }}>
            <label className="label flex items-center gap-1.5"><Tag className="size-3.5" /> Code promo</label>
            <div className="flex gap-2"><input className="input uppercase font-mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BIENVENUE10" /><button className="btn-secondary">Appliquer</button></div>
            {shop.coupon && cart.couponError && <div className="text-xs text-rose-ink mt-2">{cart.couponError}</div>}
            {shop.coupon && !cart.couponError && <div className="text-xs text-sage-600 mt-2">✓ {cart.couponPromo?.name}</div>}
          </form>
          <Summary cart={cart}>
            <button className="btn-primary w-full h-12 mt-3" onClick={() => nav('/boutique/commande')}>Passer commande</button>
            <div className="text-[11px] text-muted text-center">Paiement sécurisé · Carte ou à la livraison</div>
          </Summary>
        </div>
      </div>
      {cross.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl mb-5">Pour compléter votre routine</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{cross.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      )}
    </div>
  )
}
