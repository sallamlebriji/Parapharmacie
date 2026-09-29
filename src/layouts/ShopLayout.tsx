import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Heart, LayoutDashboard, Loader2, Menu, Search, ShoppingBag, Sparkles, Truck, User, X } from 'lucide-react'
import { actions, ShopScope, useApp, useData, useShop, useTenant } from '../lib/store'
import { CATEGORIES, NEEDS } from '../data/catalog'
import { money } from '../lib/format'
import { isLive, priceOf } from '../lib/logic'
import { ChatWidget } from '../components/ChatWidget'
import { ProductVisual } from '../components/ProductVisual'
import { Countdown, cx } from '../components/ui'

export function SmartSearch({ big, onDone }: { big?: boolean; onDone?: () => void }) {
  const d = useData()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(false)
  const s = q.trim().toLowerCase()
  const res = useMemo(() => {
    if (s.length < 2) return null
    return {
      products: d.products.filter((p) => p.active && `${p.name} ${p.brand} ${p.ref} ${p.barcode} ${p.subcategory} ${p.needs.map((n) => NEEDS[n]).join(' ')}`.toLowerCase().includes(s)).slice(0, 5),
      brands: [...new Set(d.products.map((p) => p.brand))].filter((b) => b.toLowerCase().includes(s)).slice(0, 3),
      cats: CATEGORIES.filter((c) => c.label.toLowerCase().includes(s)).slice(0, 3),
      needs: Object.entries(NEEDS).filter(([, v]) => v.toLowerCase().includes(s)).slice(0, 3),
    }
  }, [s, d.products])
  const go = (to: string) => { nav(to); setQ(''); setFocus(false); onDone?.() }
  return (
    <div className="relative w-full">
      <form onSubmit={(e) => { e.preventDefault(); go(`/boutique/catalogue?q=${encodeURIComponent(q)}`) }}>
        <Search className={cx('absolute left-4 top-1/2 -translate-y-1/2 text-soft', big ? 'size-5' : 'size-4')} />
        <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} placeholder="Produit, marque, besoin (ex. « peau sèche », « chute »), référence…" className={cx('input rounded-full bg-white', big ? 'h-14 pl-12 text-base' : 'h-10 pl-10')} />
      </form>
      {focus && res && (
        <div className="absolute z-50 mt-2 w-full card shadow-lift p-2 animate-fade-up">
          {res.needs.length + res.cats.length + res.brands.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2">
              {res.needs.map(([k, v]) => <button key={k} onMouseDown={() => go(`/boutique/catalogue?besoin=${k}`)} className="chip bg-sage-50 text-sage-700 cursor-pointer">Besoin : {v}</button>)}
              {res.cats.map((c) => <button key={c.id} onMouseDown={() => go(`/boutique/catalogue?cat=${c.id}`)} className="chip bg-cream text-ink cursor-pointer">{c.label}</button>)}
              {res.brands.map((b) => <button key={b} onMouseDown={() => go(`/boutique/catalogue?marque=${encodeURIComponent(b)}`)} className="chip bg-champagne-100 text-champagne-600 cursor-pointer">{b}</button>)}
            </div>
          )}
          {res.products.map((p) => (
            <button key={p.id} onMouseDown={() => go(`/boutique/produit/${p.id}`)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-cream text-left cursor-pointer">
              <ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="size-10 rounded-lg" />
              <span className="flex-1 min-w-0"><span className="block text-sm truncate">{p.name}</span><span className="block text-[11px] text-muted">{p.brand} · réf. {p.ref}</span></span>
              <span className="text-sm font-medium">{money(priceOf(d, p).price)}</span>
            </button>
          ))}
          {!res.products.length && <div className="p-3 text-sm text-muted">Aucun produit — essayez un besoin ou une marque.</div>}
        </div>
      )}
    </div>
  )
}

/** Loads the public storefront of the tenant given by ?boutique=slug (remembered), then renders the shop. */
export default function ShopLayout() {
  const [params] = useSearchParams()
  const wanted = params.get('boutique') ?? undefined
  const slug = useApp((s) => s.shopSlug)
  const ready = useApp((s) => !!s.shopData && !!s.shopTenant && (!wanted || wanted === s.shopSlug))
  const [error, setError] = useState('')
  useEffect(() => {
    setError('')
    actions.loadShop(wanted).catch((e) => setError(e.message))
  }, [wanted])
  if (!ready) return (
    <div className="min-h-screen grid place-items-center bg-ivory text-sm text-muted">
      {error ? <div className="text-center max-w-sm px-4"><p className="font-display text-2xl text-ink">Boutique indisponible</p><p className="mt-2">{error}</p><Link to="/" className="btn-secondary mt-5">Retour</Link></div>
        : <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Chargement de la boutique {slug}…</span>}
    </div>
  )
  return <ShopScope.Provider value={true}><ShopShell /></ShopScope.Provider>
}

function ShopShell() {
  const t = useTenant()
  const d = useData()
  const shop = useShop()
  const loc = useLocation()
  const [menu, setMenu] = useState(false)
  useEffect(() => setMenu(false), [loc.pathname, loc.search])
  const count = shop.cart.reduce((a, l) => a + l.qty, 0)
  const flash = d.promotions.find((p) => isLive(p) && (p.highlight || p.type === 'flash'))
  const freeAbove = Math.min(...d.zones.map((z) => z.freeAbove))

  return (
    <div className="min-h-screen bg-ivory flex flex-col" style={{ ['--color-sage-600' as string]: t.primaryColor }}>
      <div className="bg-sage-800 text-sage-50 text-xs">
        <div className="max-w-7xl mx-auto px-4 h-9 flex items-center justify-center gap-6">
          <span className="flex items-center gap-1.5"><Truck className="size-3.5" /> Livraison offerte dès {money(freeAbove)}</span>
          {flash && <span className="hidden sm:flex items-center gap-1.5 text-champagne-200"><Sparkles className="size-3.5" /> {flash.name} — se termine dans <Countdown to={flash.endsAt} compact /></span>}
        </div>
      </div>
      <header className="sticky top-0 z-30 bg-ivory/90 backdrop-blur border-b border-line">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
          <button className="lg:hidden btn-ghost h-9 w-9 p-0" onClick={() => setMenu(true)} aria-label="Menu"><Menu className="size-5" /></button>
          <Link to="/boutique" className="flex items-center gap-2 shrink-0">
            <span className="size-8 rounded-full grid place-items-center text-white font-display" style={{ background: t.primaryColor }}>{t.name.split(' ').pop()![0]}</span>
            <span className="font-display text-xl tracking-tight hidden sm:block">{t.name}</span>
          </Link>
          <div className="hidden md:block flex-1 max-w-xl mx-auto"><SmartSearch /></div>
          <nav className="ml-auto flex items-center gap-1">
            <Link to="/admin" className="hidden xl:inline-flex btn-ghost btn-sm" title="Back-office de démonstration"><LayoutDashboard className="size-4" /> Espace pro</Link>
            <Link to="/boutique/compte" className="btn-ghost h-10 w-10 p-0" aria-label="Mon compte"><User className="size-5" /></Link>
            <Link to="/boutique/favoris" className="btn-ghost h-10 w-10 p-0" aria-label="Favoris"><Heart className="size-5" /></Link>
            <Link to="/boutique/panier" className="relative btn-ghost h-10 w-10 p-0" aria-label="Panier">
              <ShoppingBag className="size-5" />
              {count > 0 && <span className="absolute top-1 right-0.5 min-w-4 h-4 px-1 rounded-full bg-champagne-400 text-white text-[10px] grid place-items-center">{count}</span>}
            </Link>
          </nav>
        </div>
        <div className="hidden lg:block border-t border-line/70">
          <nav className="max-w-7xl mx-auto px-4 h-11 flex items-center gap-6 text-[13px] text-muted">
            {CATEGORIES.slice(0, 9).map((c) => <NavLink key={c.id} to={`/boutique/catalogue?cat=${c.id}`} className="hover:text-ink whitespace-nowrap">{c.label.replace(' alimentaires', '')}</NavLink>)}
            <span className="ml-auto" />
            <NavLink to="/boutique/routines" className="text-ink font-medium hover:text-sage-600">Routines & packs</NavLink>
            <NavLink to="/boutique/quiz" className="text-champagne-600 font-medium hover:text-champagne-400">Quiz beauté</NavLink>
            <NavLink to="/boutique/conseils" className="hover:text-ink">Conseils</NavLink>
          </nav>
        </div>
        <div className="md:hidden px-4 pb-3"><SmartSearch /></div>
      </header>
      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/25" onClick={() => setMenu(false)} />
          <aside className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-white p-5 overflow-y-auto animate-fade-up">
            <div className="flex justify-between items-center mb-4"><span className="font-display text-xl">{t.name}</span><button className="btn-ghost h-8 w-8 p-0" onClick={() => setMenu(false)} aria-label="Fermer"><X className="size-4" /></button></div>
            <div className="space-y-1">
              {[['/boutique/routines', 'Routines & packs'], ['/boutique/quiz', 'Quiz beauté'], ['/boutique/conseils', 'Conseils'], ['/admin', 'Espace pro (démo)']].map(([to, l]) => <Link key={to} to={to} className="block py-2 font-medium">{l}</Link>)}
              <div className="pt-3 mt-3 border-t border-line text-xs uppercase tracking-wider text-soft">Catégories</div>
              {CATEGORIES.map((c) => <Link key={c.id} to={`/boutique/catalogue?cat=${c.id}`} className="block py-2 text-sm text-muted">{c.label}</Link>)}
            </div>
          </aside>
        </div>
      )}
      <main className="flex-1" key={loc.pathname}><div className="animate-fade-up"><Outlet /></div></main>
      <footer className="mt-20 bg-cream border-t border-line">
        <div className="max-w-7xl mx-auto px-4 py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-sm">
          <div>
            <div className="font-display text-xl">{t.name}</div>
            <p className="text-muted mt-2">{t.tagline}. Conseils personnalisés en boutique et en ligne.</p>
            <div className="mt-4 text-xs text-muted space-y-1">{d.stores.map((s) => <div key={s.id}>{s.name} — {s.address}</div>)}</div>
          </div>
          <div><div className="font-medium mb-3">Boutique</div><ul className="space-y-2 text-muted">{CATEGORIES.slice(0, 6).map((c) => <li key={c.id}><Link to={`/boutique/catalogue?cat=${c.id}`} className="hover:text-ink">{c.label}</Link></li>)}</ul></div>
          <div><div className="font-medium mb-3">Services</div><ul className="space-y-2 text-muted"><li><Link to="/boutique/quiz" className="hover:text-ink">Trouver ma routine</Link></li><li><Link to="/boutique/routines" className="hover:text-ink">Packs & routines</Link></li><li><Link to="/boutique/compte" className="hover:text-ink">Programme fidélité</Link></li><li><Link to="/boutique/conseils" className="hover:text-ink">Conseils beauté & santé</Link></li></ul></div>
          <div><div className="font-medium mb-3">Aide</div><ul className="space-y-2 text-muted"><li>Livraison 24–72 h partout au Maroc</li><li>Paiement sécurisé ou à la livraison</li><li>Retours sous 14 jours</li><li>Du lundi au samedi, 9h–20h</li></ul></div>
        </div>
        <div className="border-t border-line text-[11px] text-soft">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap justify-between gap-2">
            <span>© {new Date().getFullYear()} {t.name}. Les conseils fournis ne remplacent pas l’avis d’un professionnel de santé.</span>
            <Link to="/" className="hover:text-ink">Propulsé par Paraflow</Link>
          </div>
        </div>
      </footer>
      <ChatWidget />
    </div>
  )
}
