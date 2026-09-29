import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useData, useTenant } from '../../lib/store'
import { date } from '../../lib/format'
import { Empty } from '../../components/ui'
import { ProductCard } from '../../components/ProductCard'

export default function Article() {
  const { slug } = useParams()
  const d = useData()
  const t = useTenant()
  const a = d.articles.find((x) => x.slug === slug)
  useEffect(() => {
    if (!a) return
    // SEO: title, meta description and Article structured data.
    document.title = `${a.title} — ${t.name}`
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta) }
    meta.setAttribute('content', a.excerpt)
    const ld = document.createElement('script')
    ld.type = 'application/ld+json'
    ld.text = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.excerpt, datePublished: a.date, publisher: { '@type': 'Organization', name: t.name } })
    document.head.appendChild(ld)
    return () => { ld.remove(); document.title = 'Paraflow — Gestion intelligente de parapharmacie' }
  }, [a, t.name])
  if (!a) return <Empty title="Article introuvable" />
  const products = a.productIds.map((id) => d.products.find((p) => p.id === id)!).filter(Boolean)
  return (
    <article className="max-w-3xl mx-auto px-4 py-10">
      <Link to="/boutique/conseils" className="text-sm text-muted hover:text-ink inline-flex items-center gap-1"><ArrowLeft className="size-4" /> Tous les conseils</Link>
      <div className="text-[11px] uppercase tracking-[0.16em] text-champagne-600 mt-6">{a.category} · {a.readTime} min de lecture</div>
      <h1 className="text-4xl md:text-5xl mt-2 leading-tight">{a.title}</h1>
      <p className="text-lg text-muted mt-4">{a.excerpt}</p>
      <div className="text-xs text-soft mt-3">Publié le {date(a.date)} · par l’équipe {t.name}</div>
      <div className="h-56 rounded-3xl mt-8" style={{ background: `linear-gradient(135deg, ${a.cover}, #fbfaf7)` }} />
      <div className="mt-8 space-y-4 text-[17px] leading-relaxed text-ink/90">
        {a.body.map((b, i) => b.startsWith('## ') ? <h2 key={i} className="text-2xl pt-4">{b.slice(3)}</h2> : <p key={i}>{b}</p>)}
      </div>
      <div className="mt-10 rounded-2xl bg-sky-soft/60 p-4 text-sm text-sky-ink">Ces conseils sont donnés à titre informatif et ne remplacent pas une consultation médicale.</div>
      {products.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl mb-5">Les produits cités</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      )}
    </article>
  )
}
