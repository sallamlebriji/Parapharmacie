import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarClock, Download, LayoutGrid, List, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useCan, useData, useSession } from '../../lib/store'
import { CATEGORIES } from '../../data/catalog'
import { CATEGORY_LABEL } from '../../data/plans'
import { daysUntil, download, money, pct, toCSV } from '../../lib/format'
import { marginRate, ordersInRange, priceOf, productSales, stockIndex } from '../../lib/logic'
import { EASE } from '../../lib/motion'
import { Badge, Card, Drawer, Empty, Field, PageHeader, STOCK_STATE, StatusBadge, Stars, cx } from '../../components/ui'
import { ProductVisual } from '../../components/ProductVisual'
import { Tilt } from '../../components/Tilt'

type View = 'grid' | 'list'
const VIEW_KEY = 'paraflow:products-view'

export default function Products() {
  const d = useData()
  const { scope } = useSession()
  const can = useCan()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [brand, setBrand] = useState('')
  const [state, setState] = useState('')
  const [filters, setFilters] = useState(false)
  const [view, setViewState] = useState<View>(() => { try { return (localStorage.getItem(VIEW_KEY) as View) || 'list' } catch { return 'list' } })
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* ignore */ } }

  const idx = useMemo(() => stockIndex(d, scope), [d, scope])
  const sales30 = useMemo(() => productSales(ordersInRange(d, scope, 29)), [d, scope])
  // Nearest expiry per product among lots still in stock (in the selected store scope).
  const nextExpiry = useMemo(() => {
    const m = new Map<string, string>()
    d.lots.forEach((l) => {
      if (l.qty <= 0 || (scope !== 'all' && l.storeId !== scope)) return
      const cur = m.get(l.productId)
      if (!cur || l.expiresAt < cur) m.set(l.productId, l.expiresAt)
    })
    return m
  }, [d.lots, scope])
  const brands = [...new Set(d.products.map((p) => p.brand))].sort()
  const catCount = (id: string) => d.products.filter((p) => p.category === id).length
  const list = d.products.filter((p) =>
    (!q || `${p.name} ${p.brand} ${p.ref} ${p.barcode}`.toLowerCase().includes(q.toLowerCase())) &&
    (!cat || p.category === cat) && (!brand || p.brand === brand) && (!state || idx(p).state === state))

  const exportCSV = () => download('catalogue.csv', toCSV(list.map((p) => ({
    reference: p.ref, code_barres: p.barcode, nom: p.name, marque: p.brand, categorie: CATEGORY_LABEL[p.category], sous_categorie: p.subcategory,
    prix_achat: can('prix_achat.view') ? p.purchasePrice : '', prix_vente: p.price, prix_promo: p.promoPrice ?? '', stock: idx(p).physical, seuil: p.alertThreshold,
  }))))

  const expiryBadge = (id: string) => {
    const e = nextExpiry.get(id)
    if (!e) return null
    const days = daysUntil(e)
    if (days > 90) return null
    return <Badge tone={days < 0 ? 'rose' : days <= 30 ? 'rose' : 'amber'}><CalendarClock className="size-3" aria-hidden />{days < 0 ? 'Expiré' : `J-${days}`}</Badge>
  }

  const filterFields = (
    <div className="space-y-4">
      <Field label="Marque">
        <select className="input" value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">Toutes les marques</option>
          {brands.map((b) => <option key={b}>{b}</option>)}
        </select>
      </Field>
      <Field label="État du stock">
        <select className="input" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">Tous les états</option>
          <option value="ok">En stock</option><option value="faible">Stock faible</option><option value="rupture">Rupture</option>
        </select>
      </Field>
    </div>
  )

  return (
    <div>
      <PageHeader title="Produits" subtitle={`${d.products.length} références au catalogue · ${brands.length} marques`} actions={<>
        <button className="btn-secondary" onClick={exportCSV}><Download className="size-4" /> Export CSV</button>
        {can('produits.edit') && <Link to="/admin/produits/nouveau" className="btn-primary"><Plus className="size-4" /> Nouveau produit</Link>}
      </>} />

      {/* Category navigation (existing catalogue categories only) */}
      <nav aria-label="Catégories" className="-mx-1 mb-4 flex gap-2 overflow-x-auto scrollbar-thin px-1 pb-1">
        {[{ id: '', label: 'Tout le catalogue', tint: 'var(--color-sage-100)', n: d.products.length }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label, tint: c.tint, n: catCount(c.id) }))].map((c) => (
          <button key={c.id || 'all'} onClick={() => setCat(c.id)} aria-pressed={cat === c.id} className={cx('shrink-0 inline-flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-full border text-[13px] cursor-pointer transition-all duration-300', cat === c.id ? 'border-sage-300 bg-surface shadow-soft text-ink font-medium' : 'border-line bg-surface/60 text-muted hover:text-ink hover:border-sand')}>
            <span className="size-6 rounded-full" style={{ background: c.tint }} aria-hidden />
            {c.label}<span className="text-[11px] text-soft num">{c.n}</span>
          </button>
        ))}
      </nav>

      <div className="card p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-soft" aria-hidden />
          <input className="input pl-9" placeholder="Nom, marque, référence, EAN" aria-label="Rechercher un produit" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="hidden md:flex gap-3">
          <select className="input w-48" value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Marque">
            <option value="">Toutes les marques</option>
            {brands.map((b) => <option key={b}>{b}</option>)}
          </select>
          <select className="input w-48" value={state} onChange={(e) => setState(e.target.value)} aria-label="État du stock">
            <option value="">Tous les états de stock</option>
            <option value="ok">En stock</option><option value="faible">Stock faible</option><option value="rupture">Rupture</option>
          </select>
        </div>
        <button className="md:hidden btn-secondary" onClick={() => setFilters(true)}><SlidersHorizontal className="size-4" /> Filtres</button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted num">{list.length} produit{list.length > 1 ? 's' : ''}</span>
          <div role="radiogroup" aria-label="Affichage" className="flex p-0.5 rounded-lg bg-cream border border-line">
            {([['list', List, 'Liste'], ['grid', LayoutGrid, 'Grille']] as const).map(([v, Icon, label]) => (
              <button key={v} role="radio" aria-checked={view === v} title={label} onClick={() => setView(v)} className={cx('relative h-8 w-9 grid place-items-center rounded-md cursor-pointer', view === v ? 'text-ink' : 'text-soft hover:text-ink')}>
                {view === v && <motion.span layoutId="products-view" className="absolute inset-0 rounded-md bg-surface shadow-soft" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                <Icon className="relative size-4" aria-hidden /><span className="sr-only">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <Card><Empty title="Aucun produit" text="Aucun produit ne correspond à ces filtres." action={can('produits.edit') ? <Link to="/admin/produits/nouveau" className="btn-primary"><Plus className="size-4" /> Ajouter un produit</Link> : undefined} /></Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {list.map((p, i) => {
            const s = idx(p)
            const pi = priceOf(d, p)
            const sold = sales30.get(p.id)?.qty ?? 0
            return (
              <motion.button
                key={p.id} onClick={() => nav(`/admin/produits/${p.id}`)}
                initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: Math.min(i, 12) * 0.04 }}
                className="group text-left card card-hover overflow-hidden cursor-pointer focus-visible:outline-2"
              >
                <Tilt className="aspect-[4/3.4]">
                  <div className="relative h-full overflow-hidden">
                    <ProductVisual shape={p.shape} color={p.color} brand={p.brand} name={p.name} className="w-full h-full" />
                    <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1">
                      {pi.label && <span className="chip bg-rose-ink text-white">{pi.label}</span>}
                      {!p.active && <Badge>Archivé</Badge>}
                    </div>
                    <div className="absolute top-2.5 right-2.5">{expiryBadge(p.id)}</div>
                  </div>
                </Tilt>
                <div className="p-3.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-champagne-600 font-semibold">{p.brand}</div>
                  <div className="text-[13px] font-medium leading-snug mt-0.5 line-clamp-2 min-h-9">{p.name}</div>
                  <div className="text-[11px] text-soft mt-0.5">{CATEGORY_LABEL[p.category]} · {p.volume}</div>
                  <div className="flex items-end justify-between mt-3">
                    <div>
                      <div className={cx('text-base font-semibold num', pi.oldPrice && 'text-rose-ink')}>{money(pi.price)}</div>
                      {pi.oldPrice && <div className="text-[11px] text-soft line-through num">{money(pi.oldPrice)}</div>}
                    </div>
                    <div className="text-right">
                      <StatusBadge map={STOCK_STATE} value={s.state} />
                      <div className="text-[11px] text-muted mt-1 num">{s.available} dispo · {sold} vendus</div>
                    </div>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr>
                <th>Produit</th><th>Catégorie</th>
                {can('prix_achat.view') && <th className="text-right">Prix d’achat</th>}
                <th className="text-right">Prix de vente</th>
                {can('prix_achat.view') && <th className="text-right">Marge</th>}
                <th className="text-right">Stock dispo.</th><th>État</th><th>Expiration</th><th className="text-right">Ventes 30 j</th><th>Avis</th>
              </tr></thead>
              <tbody>
                {list.map((p) => {
                  const s = idx(p)
                  const pi = priceOf(d, p)
                  return (
                    <tr key={p.id} className="cursor-pointer" onClick={() => nav(`/admin/produits/${p.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/admin/produits/${p.id}`)} tabIndex={0}>
                      <td>
                        <div className="flex items-center gap-3 min-w-64">
                          <ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="size-11 rounded-xl shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-72">{p.name}</div>
                            <div className="text-[11px] text-muted num">{p.brand} · {p.ref} · {p.volume}</div>
                          </div>
                          {!p.active && <Badge>Archivé</Badge>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap"><div className="text-[13px]">{CATEGORY_LABEL[p.category]}</div><div className="text-[11px] text-muted">{p.subcategory}</div></td>
                      {can('prix_achat.view') && <td className="text-right num text-muted">{money(p.purchasePrice)}</td>}
                      <td className="text-right num whitespace-nowrap">
                        {pi.oldPrice ? <><span className="font-semibold text-rose-ink">{money(pi.price)}</span> <span className="text-[11px] text-soft line-through">{money(pi.oldPrice)}</span></> : <span className="font-semibold">{money(p.price)}</span>}
                      </td>
                      {can('prix_achat.view') && <td className="text-right num">{pct(marginRate(p) * 100, 0)}</td>}
                      <td className="text-right num">
                        <span className="font-semibold">{s.available}</span>
                        {s.reserved > 0 && <div className="text-[11px] text-muted">{s.reserved} réservé(s)</div>}
                      </td>
                      <td><StatusBadge map={STOCK_STATE} value={s.state} /></td>
                      <td>{expiryBadge(p.id) ?? <span className="text-soft text-xs">—</span>}</td>
                      <td className="text-right num">{sales30.get(p.id)?.qty ?? 0}</td>
                      <td className="whitespace-nowrap"><Stars value={p.rating} size={12} /> <span className="text-[11px] text-muted">({p.reviewsCount})</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Drawer open={filters} onClose={() => setFilters(false)} title="Filtres" footer={<button className="btn-primary w-full" onClick={() => setFilters(false)}>Voir {list.length} produits</button>}>
        <div className="p-5">{filterFields}</div>
      </Drawer>
    </div>
  )
}
