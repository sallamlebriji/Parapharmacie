import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bell, Camera, Check, ChevronDown, Heart, Minus, Plus, ShieldCheck, Sparkles, Truck } from 'lucide-react'
import { actions, useData, useShop, useShopCustomer, useTenant } from '../../lib/store'
import { CATEGORY_LABEL } from '../../data/plans'
import { NEEDS, SKIN_TYPES } from '../../data/catalog'
import { date, money, sum } from '../../lib/format'
import { availableStock, boughtTogether, complementary, priceOf, similar } from '../../lib/logic'
import { ProductVisual } from '../../components/ProductVisual'
import { Badge, Countdown, Empty, Field, Modal, Stars, cx, toast } from '../../components/ui'
import { Grid, Section } from './ShopHome'

export default function ProductPage() {
  const { id } = useParams()
  const d = useData()
  const p = d.products.find((x) => x.id === id)
  useEffect(() => { if (id) actions.viewProduct(id) }, [id])
  if (!p) return <Empty title="Produit introuvable" action={<Link className="btn-secondary" to="/boutique/catalogue">Retour au catalogue</Link>} />
  return <ProductView key={p.id} id={p.id} />
}

function ProductView({ id }: { id: string }) {
  const d = useData()
  const t = useTenant()
  const shop = useShop()
  const me = useShopCustomer()
  const nav = useNavigate()
  const p = d.products.find((x) => x.id === id)!
  const pi = priceOf(d, p)
  const stock = availableStock(d, p.id)
  const [qty, setQty] = useState(1)
  const [view, setView] = useState(0)
  const [open, setOpen] = useState<string>('description')
  const [wishOpen, setWishOpen] = useState(false)
  const [notify, setNotify] = useState(false)
  const [filter, setFilter] = useState(0)
  const [writing, setWriting] = useState(false)
  const wished = shop.wishlists.some((w) => w.productIds.includes(p.id))
  const reviews = d.reviews.filter((r) => r.productId === p.id && r.status === 'publie')
  const together = boughtTogether(d, p.id, 2)
  const bundle = [p, ...together]
  const bundlePrice = sum(bundle, (x) => priceOf(d, x).price)
  const reco = complementary(d, p, 4)
  const sim = similar(d, p, 4).filter((x) => !reco.includes(x))

  const add = () => { actions.addToCart({ kind: 'product', productId: p.id, qty }); toast(`${qty} × ${p.name} ajouté au panier`) }
  const views = [
    <ProductVisual key="a" shape={p.shape} color={p.color} brand={p.brand} name={p.name} className="w-full h-full" />,
    <div key="b" className="w-full h-full grid place-items-center" style={{ background: `radial-gradient(circle at 40% 35%, #fff, ${p.color})` }}><div className="size-2/3 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, #fff 0%, ${p.color} 45%, ${p.color} 100%)`, boxShadow: 'inset -10px -20px 40px rgba(0,0,0,.06)' }} /></div>,
    <div key="c" className="w-full h-full grid place-items-center bg-cream"><ProductVisual shape={p.shape} color={p.color} brand={p.brand} bg={false} className="w-3/4" /></div>,
    <div key="d" className="w-full h-full relative bg-gradient-to-br from-sage-100 to-champagne-100"><ProductVisual shape={p.shape} color={p.color} brand={p.brand} bg={false} className="absolute left-[8%] bottom-0 w-1/2" /><div className="absolute right-[10%] top-[18%] w-[34%] aspect-square rounded-full bg-white/60 blur-sm" /><ProductVisual shape="jar" color="#ffffff" brand="" bg={false} className="absolute right-[6%] bottom-[4%] w-[36%] opacity-70" /></div>,
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <nav className="text-xs text-muted mb-6 flex gap-1.5 flex-wrap">
        <Link to="/boutique" className="hover:text-ink">Accueil</Link>/<Link to={`/boutique/catalogue?cat=${p.category}`} className="hover:text-ink">{CATEGORY_LABEL[p.category]}</Link>/<Link to={`/boutique/catalogue?cat=${p.category}&sous=${encodeURIComponent(p.subcategory)}`} className="hover:text-ink">{p.subcategory}</Link>/<span className="text-ink">{p.name}</span>
      </nav>
      <div className="grid lg:grid-cols-2 gap-10">
        <div className="lg:sticky lg:top-32 self-start">
          <div className="grid grid-cols-[72px_1fr] gap-3">
            <div className="space-y-3">
              {views.map((v, i) => <button key={i} onClick={() => setView(i)} className={cx('block w-full aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition', view === i ? 'border-sage-500' : 'border-transparent opacity-70 hover:opacity-100')}>{v}</button>)}
            </div>
            <div className="relative aspect-square rounded-3xl overflow-hidden border border-line bg-white">
              {views[view]}
              {pi.label && <span className="absolute top-4 left-4 chip bg-rose-ink text-white h-7 px-3 text-xs">{pi.label}</span>}
            </div>
          </div>
        </div>
        <div>
          <Link to={`/boutique/catalogue?marque=${encodeURIComponent(p.brand)}`} className="text-xs uppercase tracking-[0.16em] text-champagne-600 hover:underline">{p.brand}</Link>
          <h1 className="text-3xl md:text-4xl mt-2 leading-tight">{p.name}</h1>
          <div className="flex items-center gap-3 mt-3 text-sm">
            <a href="#avis" className="flex items-center gap-1.5"><Stars value={p.rating} /><span className="font-medium">{p.rating.toFixed(1).replace('.', ',')} / 5</span><span className="text-muted">({p.reviewsCount} avis)</span></a>
            <span className="text-soft">·</span><span className="text-muted">{p.volume}</span><span className="text-soft">·</span><span className="text-muted text-xs">Réf. {p.ref}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-4">
            {p.needs.map((n) => <Link key={n} to={`/boutique/catalogue?besoin=${n}`} className="chip bg-sage-50 text-sage-700">{NEEDS[n]}</Link>)}
            {p.skinTypes.slice(0, 3).map((s) => <span key={s} className="chip bg-cream text-muted">{SKIN_TYPES[s]}</span>)}
          </div>
          <div className="mt-6 flex items-end gap-3">
            <span className={cx('text-3xl font-semibold tabular-nums', pi.oldPrice && 'text-rose-ink')}>{money(pi.price, true)}</span>
            {pi.oldPrice && <><span className="text-lg text-soft line-through tabular-nums">{money(pi.oldPrice, true)}</span><Badge tone="rose">Économisez {money(pi.oldPrice - pi.price)}</Badge></>}
          </div>
          {pi.endsAt && <div className="mt-3 inline-flex items-center gap-2 text-sm rounded-xl bg-champagne-100 text-champagne-600 px-3 py-2"><Sparkles className="size-4" /> Offre se termine dans <b><Countdown to={pi.endsAt} compact /></b></div>}
          <p className="text-muted mt-5 leading-relaxed">{p.description}</p>
          <div className="mt-5 flex items-center gap-2 text-sm">
            {stock > 10 ? <><span className="size-2 rounded-full bg-sage-500" /> En stock — expédié sous 24 h</> : stock > 0 ? <><span className="size-2 rounded-full bg-amber-ink" /> Plus que {stock} en stock</> : <><span className="size-2 rounded-full bg-rose-ink" /> Momentanément indisponible</>}
          </div>
          {stock > 0 ? (
            <>
              <div className="flex gap-3 mt-5">
                <div className="flex items-center rounded-xl border border-line bg-white">
                  <button className="h-12 w-11 grid place-items-center cursor-pointer" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Moins"><Minus className="size-4" /></button>
                  <span className="w-8 text-center tabular-nums">{qty}</span>
                  <button className="h-12 w-11 grid place-items-center cursor-pointer" onClick={() => setQty(Math.min(stock, qty + 1))} aria-label="Plus"><Plus className="size-4" /></button>
                </div>
                <button className="btn-primary h-12 flex-1" onClick={add}>Ajouter au panier</button>
                <button className={cx('btn-secondary h-12 w-12 p-0', wished && 'text-rose-ink')} onClick={() => shop.wishlists.length > 1 ? setWishOpen(true) : (actions.toggleWish(p.id), toast(wished ? 'Retiré des favoris' : 'Ajouté aux favoris'))} aria-label="Ajouter aux favoris"><Heart className={cx('size-5', wished && 'fill-current')} /></button>
              </div>
              <button className="btn-gold h-12 w-full mt-3" onClick={() => { actions.addToCart({ kind: 'product', productId: p.id, qty }); nav('/boutique/commande') }}>Acheter maintenant</button>
            </>
          ) : (
            <div className="mt-5 rounded-2xl border border-line bg-white p-4">
              {notify ? <div className="flex items-center gap-2 text-sm text-sage-700"><Check className="size-4" /> Nous vous préviendrons dès le retour en stock.</div> : (
                <button className="btn-primary w-full" onClick={() => { if (!wished) actions.toggleWish(p.id); setNotify(true); toast('Alerte retour en stock activée') }}><Bell className="size-4" /> Me prévenir du retour en stock</button>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 mt-6 text-xs text-muted">
            <div className="flex items-center gap-2 rounded-xl bg-white border border-line p-3"><Truck className="size-4 text-sage-500 shrink-0" />Livraison 24–72 h</div>
            <div className="flex items-center gap-2 rounded-xl bg-white border border-line p-3"><ShieldCheck className="size-4 text-sage-500 shrink-0" />Authenticité garantie</div>
            <div className="flex items-center gap-2 rounded-xl bg-white border border-line p-3"><Sparkles className="size-4 text-champagne-400 shrink-0" />+{Math.floor(pi.price * qty * t.settings.pointsPerDh)} points fidélité</div>
          </div>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {[['description', 'Description', p.description], ['composition', 'Composition', p.composition], ['usage', 'Mode d’utilisation', p.usage], ['warnings', 'Informations importantes', p.warnings]].map(([k, label, body]) => (
              <div key={k}>
                <button onClick={() => setOpen(open === k ? '' : k)} className="w-full flex justify-between items-center py-4 text-left font-medium cursor-pointer">{label}<ChevronDown className={cx('size-4 transition', open === k && 'rotate-180')} /></button>
                {open === k && <p className="pb-4 text-sm text-muted leading-relaxed animate-fade-up">{body}</p>}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-soft mt-4">Les informations fournies ne remplacent pas l’avis de votre médecin ou pharmacien. En cas de doute, demandez conseil à un professionnel de santé.</p>
        </div>
      </div>

      {together.length > 0 && (
        <section className="mt-16 card p-6">
          <h2 className="text-2xl mb-5">Souvent achetés ensemble</h2>
          <div className="flex flex-wrap items-center gap-4">
            {bundle.map((x, i) => (
              <div key={x.id} className="flex items-center gap-4">
                {i > 0 && <Plus className="size-5 text-soft" />}
                <Link to={`/boutique/produit/${x.id}`} className="w-36 text-center"><ProductVisual shape={x.shape} color={x.color} brand={x.brand} className="w-full aspect-square rounded-2xl border border-line" /><div className="text-xs mt-2 line-clamp-2">{x.name}</div><div className="text-sm font-medium">{money(priceOf(d, x).price)}</div></Link>
              </div>
            ))}
            <div className="ml-auto text-right">
              <div className="text-sm text-muted">Prix total des {bundle.length} produits</div>
              <div className="text-2xl font-semibold">{money(bundlePrice)}</div>
              <button className="btn-primary mt-3" onClick={() => { bundle.forEach((x) => actions.addToCart({ kind: 'product', productId: x.id, qty: 1 })); toast(`${bundle.length} produits ajoutés au panier`) }}>Ajouter les {bundle.length} au panier</button>
            </div>
          </div>
        </section>
      )}

      <Section title="Vous pourriez également aimer" eyebrow="Complétez votre routine"><Grid products={reco} /></Section>

      <section id="avis" className="max-w-7xl mx-auto mt-16 scroll-mt-32">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6"><h2 className="text-2xl md:text-3xl">Avis clients</h2><button className="btn-secondary" onClick={() => setWriting(true)}>Écrire un avis</button></div>
        <div className="grid lg:grid-cols-[300px_1fr] gap-8">
          <div className="card p-6 self-start">
            <div className="text-5xl font-semibold">{p.rating.toFixed(1).replace('.', ',')}<span className="text-lg text-muted font-normal"> / 5</span></div>
            <Stars value={p.rating} size={18} className="mt-2" />
            <div className="text-sm text-muted mt-1">{reviews.length} avis vérifiés</div>
            <div className="mt-5 space-y-2">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = reviews.filter((r) => r.rating === n).length
                return (
                  <button key={n} onClick={() => setFilter(filter === n ? 0 : n)} className={cx('w-full flex items-center gap-2 text-sm cursor-pointer rounded-md px-1', filter === n && 'bg-sage-50')}>
                    <span className="w-6">{n}★</span>
                    <span className="flex-1 h-2 rounded-full bg-cream overflow-hidden"><span className="block h-full bg-champagne-400 rounded-full" style={{ width: `${(c / Math.max(1, reviews.length)) * 100}%` }} /></span>
                    <span className="w-6 text-right text-muted text-xs">{c}</span>
                  </button>
                )
              })}
            </div>
            {filter > 0 && <button className="text-xs text-sage-600 mt-3 cursor-pointer" onClick={() => setFilter(0)}>Voir tous les avis</button>}
          </div>
          <ul className="space-y-4">
            {reviews.filter((r) => !filter || r.rating === filter).map((r) => (
              <li key={r.id} className="card p-5">
                <div className="flex items-center justify-between gap-2"><Stars value={r.rating} /><span className="text-xs text-soft">{date(r.date)}</span></div>
                <div className="font-medium mt-2">{r.title}</div>
                <p className="text-sm text-muted mt-1 leading-relaxed">{r.text}</p>
                {r.hasPhoto && <div className="mt-3 size-20 rounded-xl overflow-hidden border border-line"><ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="w-full h-full" /></div>}
                <div className="text-xs text-muted mt-3 flex items-center gap-2">{r.author}{r.verified && <Badge tone="sage"><Check className="size-3" /> Achat vérifié</Badge>}</div>
              </li>
            ))}
            {!reviews.length && <li className="text-sm text-muted">Soyez le premier à donner votre avis.</li>}
          </ul>
        </div>
      </section>

      {sim.length > 0 && <Section title="Produits similaires"><Grid products={sim} /></Section>}

      {wishOpen && (
        <Modal open onClose={() => setWishOpen(false)} title="Ajouter à une liste">
          <div className="space-y-2">
            {shop.wishlists.map((w) => (
              <button key={w.id} onClick={() => actions.toggleWish(p.id, w.id)} className="w-full flex items-center justify-between rounded-xl border border-line px-4 py-3 cursor-pointer hover:border-sage-300">
                <span>{w.name} <span className="text-xs text-muted">({w.productIds.length})</span></span>
                {w.productIds.includes(p.id) ? <Check className="size-4 text-sage-600" /> : <Plus className="size-4 text-soft" />}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {writing && <ReviewForm productId={p.id} author={me ? `${me.customer.firstName} ${me.customer.lastName[0]}.` : ''} onClose={() => setWriting(false)} />}
    </div>
  )
}

function ReviewForm({ productId, author, onClose }: { productId: string; author: string; onClose: () => void }) {
  const [f, setF] = useState({ rating: 5, title: '', text: '', author, photo: false })
  const submit = () => {
    if (!f.title || !f.text || !f.author) return toast('Merci de compléter tous les champs')
    actions.addReview({ productId, author: f.author, rating: f.rating, title: f.title, text: f.text, hasPhoto: f.photo })
    toast('Merci ! Votre avis sera publié après modération.'); onClose()
  }
  return (
    <Modal open onClose={onClose} title="Donner votre avis" footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button><button className="btn-primary" onClick={submit}>Publier</button></>}>
      <div className="space-y-4">
        <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setF({ ...f, rating: n })} className={cx('text-3xl cursor-pointer transition', n <= f.rating ? 'text-champagne-400' : 'text-sand')} aria-label={`${n} étoiles`}>★</button>)}</div>
        <Field label="Votre nom"><input className="input" value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} /></Field>
        <Field label="Titre"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Votre commentaire"><textarea rows={4} className="input" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></Field>
        <label className="flex items-center gap-2 rounded-xl border border-dashed border-sage-300 p-3 text-sm text-muted cursor-pointer"><Camera className="size-4" /> {f.photo ? 'Photo ajoutée ✓' : 'Ajouter une photo (facultatif)'}<input type="file" accept="image/*" className="hidden" onChange={(e) => setF({ ...f, photo: !!e.target.files?.length })} /></label>
      </div>
    </Modal>
  )
}
