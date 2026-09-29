import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { actions, useData } from '../../lib/store'
import { money, pct } from '../../lib/format'
import { packValue } from '../../lib/logic'
import { ProductVisual } from '../../components/ProductVisual'
import { Tabs, toast } from '../../components/ui'
import type { Pack } from '../../lib/types'

const KINDS: { id: Pack['kind'] | ''; label: string }[] = [
  { id: '', label: 'Toutes' }, { id: 'visage', label: 'Skin care' }, { id: 'imperfections', label: 'Anti-imperfections' }, { id: 'cheveux', label: 'Cheveux' },
  { id: 'homme', label: 'Homme' }, { id: 'bebe', label: 'Bébé' }, { id: 'solaire', label: 'Solaire' },
]

export default function Routines() {
  const d = useData()
  const loc = useLocation()
  const [kind, setKind] = useState<Pack['kind'] | ''>('')
  useEffect(() => { if (loc.hash) setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100) }, [loc.hash])
  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="text-center max-w-2xl mx-auto">
        <div className="text-[11px] uppercase tracking-[0.16em] text-champagne-600">Packs & routines</div>
        <h1 className="text-4xl md:text-5xl mt-2">Des routines complètes, pensées par nos experts</h1>
        <p className="text-muted mt-4">Chaque étape au bon moment, avec des produits qui fonctionnent ensemble — à prix réduit.</p>
        <Link to="/boutique/quiz" className="inline-flex items-center gap-1.5 text-sm text-sage-600 hover:underline mt-4"><Sparkles className="size-4" /> Pas sûr·e ? Faites le quiz de 1 minute</Link>
      </div>
      <div className="flex justify-center mt-8 mb-8"><Tabs value={kind} onChange={setKind} tabs={KINDS.map((k) => ({ ...k, id: k.id }))} /></div>
      <div className="space-y-6">
        {d.packs.filter((p) => !kind || p.kind === kind).map((pk) => {
          const value = packValue(d, pk)
          return (
            <article key={pk.id} id={pk.slug} className="card p-6 md:p-8 scroll-mt-40">
              <div className="grid lg:grid-cols-[1fr_280px] gap-8">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-champagne-600">{pk.tagline}</div>
                  <h2 className="text-2xl md:text-3xl mt-1">{pk.name}</h2>
                  <p className="text-muted mt-2">{pk.description}</p>
                  <ol className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-6">
                    {pk.productIds.map((id, i) => {
                      const p = d.products.find((x) => x.id === id)!
                      return (
                        <li key={id}>
                          <Link to={`/boutique/produit/${p.id}`} className="block rounded-2xl border border-line p-3 hover:border-sage-300 transition h-full">
                            <div className="flex items-center gap-2 text-xs text-muted mb-2"><span className="size-5 rounded-full bg-accent text-on-accent grid place-items-center text-[10px]">{i + 1}</span>{pk.steps[i]}</div>
                            <ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="w-full aspect-square rounded-xl" />
                            <div className="text-xs mt-2 font-medium line-clamp-2">{p.name}</div>
                            <div className="text-xs text-muted">{money(p.price)}</div>
                          </Link>
                        </li>
                      )
                    })}
                  </ol>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-sage-50 to-champagne-100/60 border border-line p-6 self-start">
                  <div className="text-sm text-muted">Prix individuel</div>
                  <div className="text-lg text-soft line-through">{money(value)}</div>
                  <div className="text-sm text-muted mt-3">Prix du pack</div>
                  <div className="text-4xl font-semibold">{money(pk.price)}</div>
                  <div className="chip bg-accent text-on-accent mt-3 h-7 px-3">Économie {money(value - pk.price)} ({pct(((value - pk.price) / value) * 100, 0)})</div>
                  <button className="btn-primary w-full h-12 mt-6" onClick={() => { actions.addToCart({ kind: 'pack', packId: pk.id, qty: 1 }); toast(`${pk.name} ajouté au panier`) }}>Ajouter la routine <ArrowRight className="size-4" /></button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
