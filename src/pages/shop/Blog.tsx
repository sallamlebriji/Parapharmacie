import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../../lib/store'
import { date } from '../../lib/format'
import { ProductVisual } from '../../components/ProductVisual'
import { Tabs } from '../../components/ui'

const CATS = ['Conseils skincare', 'Conseils cheveux', 'Hygiène', 'Bébé', 'Protection solaire', 'Beauté', 'Guides produits']

export default function Blog() {
  const d = useData()
  const [cat, setCat] = useState('')
  const list = d.articles.filter((a) => !cat || a.category === cat)
  const [first, ...rest] = list
  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="text-center max-w-2xl mx-auto">
        <div className="text-[11px] uppercase tracking-[0.16em] text-champagne-600">Le journal</div>
        <h1 className="text-4xl md:text-5xl mt-2">Conseils beauté & santé</h1>
        <p className="text-muted mt-3">Les conseils de nos pharmaciens et esthéticiennes pour prendre soin de vous au quotidien.</p>
      </div>
      <div className="flex justify-center my-8"><Tabs value={cat} onChange={setCat} tabs={[{ id: '', label: 'Tous' }, ...CATS.map((c) => ({ id: c, label: c }))]} /></div>
      {first && (
        <Link to={`/boutique/conseils/${first.slug}`} className="card overflow-hidden grid md:grid-cols-2 hover:shadow-lift transition group">
          <div className="relative min-h-64" style={{ background: `linear-gradient(135deg, ${first.cover}, #fbfaf7)` }}>
            {first.productIds.slice(0, 2).map((id, i) => { const p = d.products.find((x) => x.id === id)!; return <ProductVisual key={id} shape={p.shape} color={p.color} brand={p.brand} bg={false} className={i ? 'absolute right-[8%] bottom-0 h-52' : 'absolute left-[12%] bottom-0 h-64 transition group-hover:scale-105'} /> })}
          </div>
          <div className="p-8 md:p-10 flex flex-col justify-center">
            <div className="text-[11px] uppercase tracking-[0.14em] text-champagne-600">{first.category} · {first.readTime} min de lecture</div>
            <h2 className="text-3xl mt-2">{first.title}</h2>
            <p className="text-muted mt-3">{first.excerpt}</p>
            <div className="text-xs text-soft mt-4">{date(first.date)}</div>
          </div>
        </Link>
      )}
      <div className="grid md:grid-cols-3 gap-5 mt-6">
        {rest.map((a) => (
          <Link key={a.id} to={`/boutique/conseils/${a.slug}`} className="card overflow-hidden hover:shadow-lift transition">
            <div className="h-36" style={{ background: `linear-gradient(135deg, ${a.cover}, #fbfaf7)` }} />
            <div className="p-5"><div className="text-[11px] uppercase tracking-[0.14em] text-champagne-600">{a.category}</div><div className="font-display text-lg mt-1 leading-snug">{a.title}</div><p className="text-sm text-muted mt-2 line-clamp-2">{a.excerpt}</p></div>
          </Link>
        ))}
      </div>
    </div>
  )
}
