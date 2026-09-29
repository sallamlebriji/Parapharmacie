import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Heart, Plus, TrendingDown } from 'lucide-react'
import { actions, useData, useShop } from '../../lib/store'
import { availableStock, priceOf } from '../../lib/logic'
import { ProductCard } from '../../components/ProductCard'
import { Empty, Tabs, Toggle, toast } from '../../components/ui'

export default function Wishlist() {
  const d = useData()
  const shop = useShop()
  const [active, setActive] = useState(shop.wishlists[0]?.id ?? '')
  const [name, setName] = useState('')
  const list = shop.wishlists.find((w) => w.id === active) ?? shop.wishlists[0]
  const products = list.productIds.map((id) => d.products.find((p) => p.id === id)!).filter(Boolean)
  const drops = products.filter((p) => priceOf(d, p).oldPrice)
  const back = products.filter((p) => availableStock(d, p.id) > 0)

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-3xl md:text-4xl">Mes favoris</h1>
      <div className="flex flex-wrap items-center gap-3 mt-6">
        <Tabs value={list.id} onChange={setActive} tabs={shop.wishlists.map((w) => ({ id: w.id, label: w.name, count: w.productIds.length }))} />
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; actions.createWishlist(name.trim()); setName(''); toast('Liste créée') }}>
          <input className="input h-9 w-48" placeholder="Nouvelle liste (ex. Routine été)" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-secondary h-9" aria-label="Créer"><Plus className="size-4" /></button>
        </form>
      </div>
      <div className="card p-4 mt-4 flex flex-wrap gap-6 items-center">
        <span className="text-sm font-medium flex items-center gap-2"><Bell className="size-4 text-sage-500" /> Alertes pour « {list.name} »</span>
        <label className="flex items-center gap-2 text-sm"><Toggle on={list.alerts.stock} onChange={() => actions.toggleWishAlert(list.id, 'stock')} label="Retour en stock" /> Retour en stock</label>
        <label className="flex items-center gap-2 text-sm"><Toggle on={list.alerts.price} onChange={() => actions.toggleWishAlert(list.id, 'price')} label="Baisse de prix" /> Baisse de prix</label>
        {list.alerts.price && drops.length > 0 && <span className="chip bg-rose-soft text-rose-ink h-7"><TrendingDown className="size-3.5" /> {drops.length} produit(s) en baisse de prix</span>}
        <span className="text-xs text-muted ml-auto">{back.length}/{products.length} disponibles</span>
      </div>
      {products.length === 0 ? <Empty icon={<Heart className="size-5" />} title="Cette liste est vide" text="Touchez le cœur d’un produit pour l’ajouter." action={<Link to="/boutique/catalogue" className="btn-primary">Découvrir les produits</Link>} /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      )}
    </div>
  )
}
