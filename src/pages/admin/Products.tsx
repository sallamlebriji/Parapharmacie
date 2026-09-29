import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, Plus, Search } from 'lucide-react'
import { useCan, useData, useSession } from '../../lib/store'
import { CATEGORIES } from '../../data/catalog'
import { CATEGORY_LABEL } from '../../data/plans'
import { download, money, pct, toCSV } from '../../lib/format'
import { marginRate, priceOf, stockIndex } from '../../lib/logic'
import { Badge, Card, Empty, PageHeader, STOCK_STATE, StatusBadge, Stars } from '../../components/ui'
import { ProductVisual } from '../../components/ProductVisual'

export default function Products() {
  const d = useData()
  const { scope } = useSession()
  const can = useCan()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [brand, setBrand] = useState('')
  const [state, setState] = useState('')
  const idx = useMemo(() => stockIndex(d, scope), [d, scope])
  const brands = [...new Set(d.products.map((p) => p.brand))].sort()
  const list = d.products.filter((p) =>
    (!q || `${p.name} ${p.brand} ${p.ref} ${p.barcode}`.toLowerCase().includes(q.toLowerCase())) &&
    (!cat || p.category === cat) && (!brand || p.brand === brand) && (!state || idx(p).state === state))

  const exportCSV = () => download('catalogue.csv', toCSV(list.map((p) => ({
    reference: p.ref, code_barres: p.barcode, nom: p.name, marque: p.brand, categorie: CATEGORY_LABEL[p.category], sous_categorie: p.subcategory,
    prix_achat: can('prix_achat.view') ? p.purchasePrice : '', prix_vente: p.price, prix_promo: p.promoPrice ?? '', stock: idx(p).physical, seuil: p.alertThreshold,
  }))))

  return (
    <div>
      <PageHeader title="Produits" subtitle={`${d.products.length} références au catalogue · ${brands.length} marques`} actions={<>
        <button className="btn-secondary" onClick={exportCSV}><Download className="size-4" /> Export CSV</button>
        {can('produits.edit') && <Link to="/admin/produits/nouveau" className="btn-primary"><Plus className="size-4" /> Nouveau produit</Link>}
      </>} />
      <Card className="mb-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-soft" />
            <input className="input pl-9" placeholder="Nom, marque, référence, EAN" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Toutes les catégories</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select className="input" value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">Toutes les marques</option>
            {brands.map((b) => <option key={b}>{b}</option>)}
          </select>
          <select className="input" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">Tous les états de stock</option>
            <option value="ok">En stock</option><option value="faible">Stock faible</option><option value="rupture">Rupture</option>
          </select>
        </div>
      </Card>
      <Card padded={false}>
        {list.length === 0 ? <Empty title="Aucun produit" text="Modifiez vos filtres ou ajoutez un produit." /> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr>
                <th>Produit</th><th>Catégorie</th>
                {can('prix_achat.view') && <th className="text-right">Prix d’achat</th>}
                <th className="text-right">Prix de vente</th>
                {can('prix_achat.view') && <th className="text-right">Marge</th>}
                <th className="text-right">Stock dispo.</th><th>État</th><th>Avis</th>
              </tr></thead>
              <tbody>
                {list.map((p) => {
                  const s = idx(p)
                  const pi = priceOf(d, p)
                  return (
                    <tr key={p.id} className="cursor-pointer" onClick={() => nav(`/admin/produits/${p.id}`)}>
                      <td>
                        <div className="flex items-center gap-3 min-w-64">
                          <ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="size-11 rounded-lg shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-72">{p.name}</div>
                            <div className="text-[11px] text-muted">{p.brand} · {p.ref} · {p.volume}</div>
                          </div>
                          {!p.active && <Badge>Archivé</Badge>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap"><div className="text-[13px]">{CATEGORY_LABEL[p.category]}</div><div className="text-[11px] text-muted">{p.subcategory}</div></td>
                      {can('prix_achat.view') && <td className="text-right tabular-nums text-muted">{money(p.purchasePrice)}</td>}
                      <td className="text-right tabular-nums whitespace-nowrap">
                        {pi.oldPrice ? <><span className="font-medium text-rose-ink">{money(pi.price)}</span> <span className="text-[11px] text-soft line-through">{money(pi.oldPrice)}</span></> : <span className="font-medium">{money(p.price)}</span>}
                      </td>
                      {can('prix_achat.view') && <td className="text-right tabular-nums">{pct(marginRate(p) * 100, 0)}</td>}
                      <td className="text-right tabular-nums">
                        <span className="font-medium">{s.available}</span>
                        {s.reserved > 0 && <div className="text-[11px] text-muted">{s.reserved} réservé(s)</div>}
                      </td>
                      <td><StatusBadge map={STOCK_STATE} value={s.state} /></td>
                      <td className="whitespace-nowrap"><Stars value={p.rating} size={12} /> <span className="text-[11px] text-muted">({p.reviewsCount})</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
