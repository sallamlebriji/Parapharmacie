import { Link } from 'react-router-dom'
import { Heart, Plus } from 'lucide-react'
import { actions, useData, useShop } from '../lib/store'
import { money } from '../lib/format'
import { availableStock, priceOf } from '../lib/logic'
import type { Product } from '../lib/types'
import { ProductVisual } from './ProductVisual'
import { Stars, cx, toast } from './ui'

export function ProductCard({ p, compact }: { p: Product; compact?: boolean }) {
  const d = useData()
  const shop = useShop()
  const pi = priceOf(d, p)
  const stock = availableStock(d, p.id)
  const wished = shop.wishlists.some((w) => w.productIds.includes(p.id))
  return (
    <div className="group relative card overflow-hidden transition hover:shadow-lift hover:-translate-y-0.5">
      <Link to={`/boutique/produit/${p.id}`} className="block">
        <div className="relative aspect-square overflow-hidden">
          <ProductVisual shape={p.shape} color={p.color} brand={p.brand} name={p.name} className="w-full h-full transition duration-500 group-hover:scale-[1.04]" />
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {pi.label && <span className="chip bg-rose-ink text-white">{pi.label}</span>}
            {p.isNew && <span className="chip bg-surface/90 text-sage-700 border border-sage-200">Nouveau</span>}
            {stock === 0 && <span className="chip bg-ink/80 text-white">Épuisé</span>}
          </div>
        </div>
        <div className={cx('p-4', compact && 'p-3')}>
          <div className="text-[11px] uppercase tracking-[0.12em] text-champagne-600">{p.brand}</div>
          <div className="text-sm font-medium leading-snug mt-1 line-clamp-2 min-h-10">{p.name}</div>
          {!compact && <div className="flex items-center gap-1.5 mt-1.5"><Stars value={p.rating} size={12} /><span className="text-[11px] text-muted">({p.reviewsCount})</span></div>}
          <div className="flex items-baseline gap-2 mt-2">
            <span className={cx('font-semibold tabular-nums', pi.oldPrice && 'text-rose-ink')}>{money(pi.price)}</span>
            {pi.oldPrice && <span className="text-xs text-soft line-through tabular-nums">{money(pi.oldPrice)}</span>}
            <span className="text-[11px] text-soft ml-auto">{p.volume}</span>
          </div>
        </div>
      </Link>
      <button onClick={() => { actions.toggleWish(p.id); toast(wished ? 'Retiré des favoris' : 'Ajouté aux favoris') }} className="absolute top-3 right-3 size-8 rounded-full bg-surface/90 grid place-items-center shadow-soft cursor-pointer hover:scale-110 transition" aria-label="Favoris">
        <Heart className={cx('size-4', wished ? 'fill-rose-ink text-rose-ink' : 'text-muted')} />
      </button>
      {stock > 0 && (
        <button onClick={() => { actions.addToCart({ kind: 'product', productId: p.id, qty: 1 }); toast('Ajouté au panier') }} className="absolute right-3 top-13 sm:opacity-0 sm:translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition size-9 rounded-full bg-accent text-on-accent grid place-items-center shadow-lift cursor-pointer hover:bg-accent-hover" aria-label="Ajouter au panier">
          <Plus className="size-4" />
        </button>
      )}
    </div>
  )
}
