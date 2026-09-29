import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Banknote, Check, CreditCard, Lock, MapPin, Store, Truck, Zap } from 'lucide-react'
import { actions, useData, useShop, useShopCustomer, useTenant } from '../../lib/store'
import { money } from '../../lib/format'
import { computeCart } from '../../lib/logic'
import { Field, cx } from '../../components/ui'
import { Summary } from './Cart'

const STEPS = ['Panier', 'Informations', 'Livraison', 'Paiement', 'Confirmation']

export default function Checkout() {
  const d = useData()
  const t = useTenant()
  const shop = useShop()
  const me = useShopCustomer()
  const nav = useNavigate()
  const cities = [...new Set(d.zones.flatMap((z) => z.cities))]
  const [step, setStep] = useState(1)
  const [info, setInfo] = useState({ firstName: me?.customer.firstName ?? '', lastName: me?.customer.lastName ?? '', email: me?.customer.email ?? '', phone: me?.customer.phone ?? '', address: me?.customer.address ?? '', city: me && cities.includes(me.customer.city) ? me.customer.city : cities[0] })
  const [mode, setMode] = useState<'standard' | 'express' | 'retrait'>('standard')
  const [method, setMethod] = useState<'carte' | 'livraison'>('carte')
  const [points, setPoints] = useState(false)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [placing, setPlacing] = useState(false)
  const zone = d.zones.find((z) => z.active && z.cities.includes(info.city)) ?? d.zones[d.zones.length - 1]
  const cart = computeCart(d, t, shop.cart, { coupon: shop.coupon, customer: me?.customer, zoneId: zone.id, mode, points: points ? Infinity : 0 })
  if (!shop.cart.length) return <Navigate to="/boutique/panier" replace />

  const validInfo = () => {
    const e: Record<string, boolean> = {}
    ;(['firstName', 'lastName', 'phone'] as const).forEach((k) => { if (!info[k].trim()) e[k] = true })
    if (!/^\S+@\S+\.\S+$/.test(info.email)) e.email = true
    if (!/^0[5-7][\d\s]{8,}$/.test(info.phone.trim())) e.phone = true
    setErrors(e)
    return !Object.keys(e).length
  }
  const place = async () => {
    setPlacing(true)
    try {
      // Totals are recomputed by the server; only the customer's choices are sent.
      const id = await actions.placeWebOrder({ lines: shop.cart, customer: info, coupon: cart.couponError ? undefined : shop.coupon || undefined, mode, method, usePoints: points })
      nav(`/boutique/suivi/${id}?confirmation=1`)
    } catch { setPlacing(false) }
  }
  const inp = (k: keyof typeof info, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label}><input className={cx('input', errors[k] && 'border-rose-ink ring-4 ring-rose-soft')} value={info[k]} onChange={(e) => setInfo({ ...info, [k]: e.target.value })} {...props} /></Field>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <ol className="flex items-center justify-between max-w-3xl mx-auto mb-10">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1 flex items-center">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <span className={cx('size-8 rounded-full grid place-items-center text-xs font-semibold border-2 transition', i < step ? 'bg-sage-600 border-sage-600 text-white' : i === step ? 'border-sage-600 text-sage-700 bg-white ring-4 ring-sage-100' : 'border-line text-soft bg-white')}>{i < step ? <Check className="size-4" /> : i + 1}</span>
              <span className={cx('text-[11px] sm:text-xs', i <= step ? 'text-ink font-medium' : 'text-soft')}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <span className={cx('h-0.5 flex-1 -mt-5', i < step ? 'bg-sage-500' : 'bg-line')} />}
          </li>
        ))}
      </ol>
      <div className="grid lg:grid-cols-[1fr_380px] gap-8">
        <div className="card p-6 md:p-8">
          {step === 1 && (
            <div className="animate-fade-up">
              <h2 className="text-2xl">Vos informations</h2>
              {!me && <p className="text-sm text-muted mt-1">Déjà client ? <Link to="/boutique/compte" className="text-sage-600 hover:underline">Connectez-vous</Link> pour cumuler vos points.</p>}
              <div className="grid sm:grid-cols-2 gap-4 mt-6">
                {inp('firstName', 'Prénom', { autoComplete: 'given-name' })}
                {inp('lastName', 'Nom', { autoComplete: 'family-name' })}
                {inp('email', 'Email', { type: 'email', autoComplete: 'email' })}
                {inp('phone', 'Téléphone', { type: 'tel', autoComplete: 'tel', placeholder: '06 12 34 56 78' })}
              </div>
              {Object.keys(errors).length > 0 && <p className="text-xs text-rose-ink mt-3">Merci de vérifier les champs en rouge.</p>}
              <button className="btn-primary h-12 w-full mt-8" onClick={() => validInfo() && setStep(2)}>Continuer vers la livraison</button>
            </div>
          )}
          {step === 2 && (
            <div className="animate-fade-up">
              <h2 className="text-2xl">Livraison</h2>
              <div className="grid sm:grid-cols-2 gap-4 mt-6">
                <div className="sm:col-span-2">{inp('address', 'Adresse', { autoComplete: 'street-address' })}</div>
                <Field label="Ville"><select className="input" value={info.city} onChange={(e) => setInfo({ ...info, city: e.target.value })}>{cities.map((c) => <option key={c}>{c}</option>)}</select></Field>
                <div className="flex items-end pb-2 text-xs text-muted"><MapPin className="size-3.5 mr-1" /> {zone.name}</div>
              </div>
              <div className="space-y-3 mt-6">
                {[
                  { id: 'standard' as const, icon: Truck, label: 'Livraison standard', desc: zone.standardDelay, price: cart.subtotal - cart.bxgy - cart.couponDiscount >= zone.freeAbove ? 'Offerte' : money(zone.standardFee) },
                  { id: 'express' as const, icon: Zap, label: 'Livraison express', desc: zone.expressDelay, price: money(zone.expressFee) },
                  ...(d.stores.some((s) => s.city === info.city) ? [{ id: 'retrait' as const, icon: Store, label: 'Retrait en boutique', desc: `${d.stores.find((s) => s.city === info.city)!.name} — prêt en 2 h`, price: 'Gratuit' }] : []),
                ].map((o) => (
                  <button key={o.id} onClick={() => setMode(o.id)} className={cx('w-full flex items-center gap-4 rounded-2xl border p-4 text-left cursor-pointer transition', mode === o.id ? 'border-sage-500 bg-sage-50 ring-4 ring-sage-100' : 'border-line hover:border-sage-300')}>
                    <o.icon className="size-5 text-sage-600" />
                    <div className="flex-1"><div className="font-medium text-sm">{o.label}</div><div className="text-xs text-muted">{o.desc}</div></div>
                    <span className="text-sm font-medium">{o.price}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 mt-8"><button className="btn-secondary h-12" onClick={() => setStep(1)}>Retour</button><button className="btn-primary h-12 flex-1" onClick={() => { if (!info.address.trim()) { setErrors({ address: true }); return } setStep(3) }}>Continuer vers le paiement</button></div>
            </div>
          )}
          {step === 3 && (
            <div className="animate-fade-up">
              <h2 className="text-2xl">Paiement</h2>
              <div className="space-y-3 mt-6">
                {[
                  { id: 'carte' as const, icon: CreditCard, label: 'Carte bancaire', desc: 'Visa, Mastercard, CMI — paiement 3-D Secure' },
                  { id: 'livraison' as const, icon: Banknote, label: 'Paiement à la livraison', desc: 'En espèces ou par carte auprès du livreur' },
                ].map((o) => (
                  <button key={o.id} onClick={() => setMethod(o.id)} className={cx('w-full flex items-center gap-4 rounded-2xl border p-4 text-left cursor-pointer transition', method === o.id ? 'border-sage-500 bg-sage-50 ring-4 ring-sage-100' : 'border-line hover:border-sage-300')}>
                    <o.icon className="size-5 text-sage-600" />
                    <div><div className="font-medium text-sm">{o.label}</div><div className="text-xs text-muted">{o.desc}</div></div>
                  </button>
                ))}
              </div>
              {method === 'carte' && <p className="mt-4 text-xs text-muted flex items-center gap-1.5"><Lock className="size-3.5" /> Vous serez redirigé vers la page sécurisée de notre prestataire de paiement. Aucune donnée bancaire n’est stockée par la boutique. (Démo : le paiement est simulé.)</p>}
              {me && cart.maxPoints > 0 && (
                <label className="mt-6 flex items-center gap-3 rounded-2xl border border-champagne-200 bg-champagne-100/50 p-4 cursor-pointer">
                  <input type="checkbox" checked={points} onChange={(e) => setPoints(e.target.checked)} />
                  <span className="text-sm">Utiliser <b>{cart.maxPoints} points</b> fidélité (−{money(cart.maxPoints * t.settings.pointValue)})<span className="block text-xs text-muted">Solde : {me.customer.points} points</span></span>
                </label>
              )}
              <div className="flex gap-3 mt-8"><button className="btn-secondary h-12" onClick={() => setStep(2)}>Retour</button><button className="btn-primary h-12 flex-1" disabled={placing} onClick={place}>{method === 'carte' ? `Payer ${money(cart.total, true)}` : `Confirmer la commande (${money(cart.total, true)})`}</button></div>
              <p className="text-[11px] text-soft mt-3">En validant, vous acceptez les conditions générales de vente.</p>
            </div>
          )}
        </div>
        <div className="lg:sticky lg:top-32 self-start space-y-3">
          <div className="card p-4 space-y-2">
            {cart.rows.map((r) => <div key={r.key} className="flex justify-between text-sm gap-3"><span className="truncate">{r.line.qty} × {r.name}</span><span className="tabular-nums shrink-0">{money(r.total)}</span></div>)}
          </div>
          <Summary cart={cart} />
        </div>
      </div>
    </div>
  )
}
