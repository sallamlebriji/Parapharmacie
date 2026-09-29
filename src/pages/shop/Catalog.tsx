import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { useData } from '../../lib/store'
import { CATEGORIES, NEEDS, SKIN_TYPES } from '../../data/catalog'
import { priceOf, soldQty, stockIndex } from '../../lib/logic'
import { ProductCard } from '../../components/ProductCard'
import { Empty, Stars, cx } from '../../components/ui'


export default function Catalog() {
  const d = useData()
  const [params, setParams] = useSearchParams()
  const [mobileFilters, setMobileFilters] = useState(false)
  const get = (k: string) => params.get(k) ?? ''
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }) }
  const q = get('q').toLowerCase(), cat = get('cat'), sub = get('sous'), brand = get('marque'), need = get('besoin'), skin = get('peau')
  const promo = get('promo') === '1', dispo = get('dispo') === '1', rating = +get('note') || 0
  const maxPrice = +get('max') || 0
  const sort = get('tri') || 'pertinence'
  const idx = useMemo(() => stockIndex(d, 'all'), [d])
  const sales = useMemo(() => soldQty(d), [d])
  const brands = [...new Set(d.products.map((p) => p.brand))].sort()
  const catObj = CATEGORIES.find((c) => c.id === cat)

  const base = d.products.filter((p) => p.active && (!q || `${p.name} ${p.brand} ${p.ref} ${p.barcode} ${p.subcategory} ${p.description} ${p.needs.map((n) => NEEDS[n]).join(' ')} ${p.skinTypes.map((s) => SKIN_TYPES[s]).join(' ')}`.toLowerCase().includes(q)))
  const list = base.filter((p) => {
    const pi = priceOf(d, p)
    return (!cat || p.category === cat) && (!sub || p.subcategory === sub) && (!brand || p.brand === brand) && (!need || p.needs.includes(need)) && (!skin || p.skinTypes.includes(skin)) &&
      (!promo || !!pi.oldPrice) && (!dispo || idx(p).available > 0) && (!rating || p.rating >= rating) && (!maxPrice || pi.price <= maxPrice)
  }).sort((a, b) => {
    if (sort === 'prix-asc') return priceOf(d, a).price - priceOf(d, b).price
    if (sort === 'prix-desc') return priceOf(d, b).price - priceOf(d, a).price
    if (sort === 'note') return b.rating - a.rating
    if (sort === 'nouveautes') return b.createdAt.localeCompare(a.createdAt)
    if (sort === 'ventes') return (sales.get(b.id) ?? 0) - (sales.get(a.id) ?? 0)
    return 0
  })
  const count = (f: (p: typeof base[number]) => boolean) => base.filter(f).length
  const active = [...params.entries()].filter(([k]) => k !== 'tri')
  const labels: Record<string, (v: string) => string> = { q: (v) => `« ${v} »`, cat: (v) => CATEGORIES.find((c) => c.id === v)?.label ?? v, sous: (v) => v, marque: (v) => v, besoin: (v) => NEEDS[v], peau: (v) => SKIN_TYPES[v], promo: () => 'En promotion', dispo: () => 'Disponible', note: (v) => `${v}★ et +`, max: (v) => `≤ ${v} DH` }

  const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="py-4 border-b border-line"><div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2.5">{title}</div>{children}</div>
  )
  const Opt = ({ on, onClick, children, n }: { on: boolean; onClick: () => void; children: React.ReactNode; n?: number }) => (
    <button onClick={onClick} className={cx('w-full flex items-center justify-between text-left text-sm py-1 cursor-pointer', on ? 'text-sage-700 font-medium' : 'text-muted hover:text-ink')}>
      <span className="flex items-center gap-2"><span className={cx('size-3.5 rounded border grid place-items-center', on ? 'bg-accent border-accent' : 'border-sand')}>{on && <span className="size-1.5 rounded-sm bg-surface" />}</span>{children}</span>
      {n !== undefined && <span className="text-[11px] text-soft">{n}</span>}
    </button>
  )

  const filters = (
    <div>
      <Group title="Catégorie">
        {CATEGORIES.map((c) => <Opt key={c.id} on={cat === c.id} n={count((p) => p.category === c.id)} onClick={() => { const p = new URLSearchParams(params); p.delete('sous'); if (cat === c.id) p.delete('cat'); else p.set('cat', c.id); setParams(p, { replace: true }) }}>{c.label}</Opt>)}
      </Group>
      {catObj && <Group title="Sous-catégorie">{catObj.subs.map((s) => <Opt key={s} on={sub === s} onClick={() => set('sous', sub === s ? '' : s)}>{s}</Opt>)}</Group>}
      <Group title="Besoin">{Object.entries(NEEDS).map(([k, v]) => <Opt key={k} on={need === k} n={count((p) => p.needs.includes(k))} onClick={() => set('besoin', need === k ? '' : k)}>{v}</Opt>)}</Group>
      <Group title="Type de peau">{Object.entries(SKIN_TYPES).map(([k, v]) => <Opt key={k} on={skin === k} onClick={() => set('peau', skin === k ? '' : k)}>{v}</Opt>)}</Group>
      <Group title="Prix maximum">
        <input type="range" min={0} max={500} step={10} value={maxPrice || 500} onChange={(e) => set('max', e.target.value === '500' ? '' : e.target.value)} className="w-full accent-[var(--color-sage-600)]" aria-label="Prix maximum" />
        <div className="text-xs text-muted flex justify-between"><span>0 DH</span><span className="text-ink font-medium">{maxPrice ? `≤ ${maxPrice} DH` : 'Tous les prix'}</span></div>
      </Group>
      <Group title="Marque"><div className="max-h-56 overflow-y-auto scrollbar-thin pr-1">{brands.map((b) => <Opt key={b} on={brand === b} n={count((p) => p.brand === b)} onClick={() => set('marque', brand === b ? '' : b)}>{b}</Opt>)}</div></Group>
      <Group title="Disponibilité & offres">
        <Opt on={dispo} onClick={() => set('dispo', dispo ? '' : '1')}>En stock uniquement</Opt>
        <Opt on={promo} n={count((p) => !!priceOf(d, p).oldPrice)} onClick={() => set('promo', promo ? '' : '1')}>En promotion</Opt>
      </Group>
      <Group title="Avis clients">{[4.5, 4, 3].map((r) => <Opt key={r} on={rating === r} onClick={() => set('note', rating === r ? '' : String(r))}><Stars value={r} size={12} /> <span className="text-xs">et +</span></Opt>)}</Group>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="text-xs text-muted">Boutique {catObj && `/ ${catObj.label}`}</div>
        <h1 className="text-3xl md:text-4xl mt-1">{q ? `Résultats pour « ${get('q')} »` : brand || catObj?.label || (need ? NEEDS[need] : promo ? 'Promotions' : 'Tous nos produits')}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button className="lg:hidden btn-secondary btn-sm" onClick={() => setMobileFilters(true)}><SlidersHorizontal className="size-3.5" /> Filtres</button>
        {active.map(([k, v]) => <button key={k} onClick={() => set(k, '')} className="chip bg-surface border border-line text-ink h-7 cursor-pointer hover:border-sage-300">{labels[k]?.(v) ?? v} <X className="size-3" /></button>)}
        {active.length > 0 && <button className="text-xs text-muted hover:text-ink underline cursor-pointer" onClick={() => setParams({})}>Tout effacer</button>}
        <span className="text-sm text-muted ml-auto">{list.length} produit{list.length > 1 ? 's' : ''}</span>
        <select className="input h-9 w-auto" value={sort} onChange={(e) => set('tri', e.target.value === 'pertinence' ? '' : e.target.value)}>
          <option value="pertinence">Pertinence</option><option value="ventes">Meilleures ventes</option><option value="nouveautes">Nouveautés</option><option value="prix-asc">Prix croissant</option><option value="prix-desc">Prix décroissant</option><option value="note">Mieux notés</option>
        </select>
      </div>
      <div className="grid lg:grid-cols-[240px_1fr] gap-8">
        <aside className="hidden lg:block">{filters}</aside>
        <div>
          {list.length === 0 ? <Empty title="Aucun produit ne correspond" text="Essayez d’élargir vos filtres ou de rechercher un besoin (hydratation, imperfections…)." action={<button className="btn-secondary" onClick={() => setParams({})}>Réinitialiser</button>} /> : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          )}
        </div>
      </div>
      {mobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/25" onClick={() => setMobileFilters(false)} />
          <div className="absolute inset-y-0 right-0 w-80 max-w-[90vw] bg-surface p-5 overflow-y-auto animate-fade-up">
            <div className="flex justify-between items-center"><span className="font-display text-xl">Filtres</span><button className="btn-ghost h-8 w-8 p-0" onClick={() => setMobileFilters(false)} aria-label="Fermer"><X className="size-4" /></button></div>
            {filters}
            <button className="btn-primary w-full mt-4" onClick={() => setMobileFilters(false)}>Voir {list.length} produits</button>
          </div>
        </div>
      )}
    </div>
  )
}
