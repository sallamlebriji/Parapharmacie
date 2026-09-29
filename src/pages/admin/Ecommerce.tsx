import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ExternalLink, ImageIcon, Plus, X } from 'lucide-react'
import { actions, useData } from '../../lib/store'
import { date, money, pct, slugify, sum, uid } from '../../lib/format'
import { ordersInRange, packValue } from '../../lib/logic'
import { Badge, Card, Field, Modal, PageHeader, Stars, Stat, Tabs, cx, toast } from '../../components/ui'
import { ProductVisual } from '../../components/ProductVisual'
import type { Pack } from '../../lib/types'

export default function Ecommerce() {
  const d = useData()
  const [tab, setTab] = useState<'apercu' | 'packs' | 'avis' | 'contenu'>('apercu')
  const [pack, setPack] = useState<Pack | null>(null)
  const [ratingFilter, setRatingFilter] = useState(0)
  const a30 = d.analytics.slice(-30)
  const visits = sum(a30, (a) => a.visits)
  const web30 = ordersInRange(d, 'all', 29).filter((o) => o.channel === 'web')
  const carts = sum(a30, (a) => a.addToCart)
  const checkouts = sum(a30, (a) => a.checkouts)
  const pending = d.reviews.filter((r) => r.status === 'en_attente')
  const reviews = d.reviews.filter((r) => !ratingFilter || r.rating === ratingFilter).sort((a, b) => (a.status === b.status ? b.date.localeCompare(a.date) : a.status === 'en_attente' ? -1 : 1)).slice(0, 60)

  return (
    <div>
      <PageHeader title="E-commerce" subtitle="Pilotez votre boutique en ligne : performances, packs & routines, avis clients et contenus." actions={<Link to="/boutique" target="_blank" className="btn-secondary"><ExternalLink className="size-4" /> Ouvrir la boutique</Link>} />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ id: 'apercu', label: 'Aperçu' }, { id: 'packs', label: 'Packs & routines', count: d.packs.length }, { id: 'avis', label: 'Avis clients', count: pending.length }, { id: 'contenu', label: 'Blog & contenus', count: d.articles.length }]} />

      {tab === 'apercu' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Visites (30 j)" value={visits.toLocaleString('fr-FR')} />
            <Stat label="Taux de conversion" value={pct((web30.length / visits) * 100, 2)} tone="gold" />
            <Stat label="Paniers abandonnés" value={(carts - web30.length).toLocaleString('fr-FR')} hint={pct(((carts - web30.length) / carts) * 100, 0) + ' des paniers'} tone="rose" />
            <Stat label="CA en ligne (30 j)" value={money(sum(web30, (o) => o.total))} tone="sky" />
          </div>
          <Card title="Tunnel de conversion (30 jours)">
            <div className="space-y-3">
              {[['Visites', visits], ['Ajouts au panier', carts], ['Checkouts démarrés', checkouts], ['Commandes', web30.length]].map(([label, v], i) => (
                <div key={label as string}>
                  <div className="flex justify-between text-sm mb-1"><span>{label}</span><span className="tabular-nums font-medium">{(v as number).toLocaleString('fr-FR')} {i > 0 && <span className="text-xs text-muted">({pct(((v as number) / visits) * 100, 1)})</span>}</span></div>
                  <div className="h-7 rounded-lg bg-cream overflow-hidden"><div className="h-full rounded-lg bg-gradient-to-r from-sage-400 to-sage-500" style={{ width: `${Math.max(2, ((v as number) / visits) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'packs' && (
        <>
          <div className="flex justify-end mb-3"><button className="btn-primary" onClick={() => setPack({ id: uid('pk'), slug: '', name: '', kind: 'visage', tagline: '', description: '', productIds: [], price: 0, steps: [] })}><Plus className="size-4" /> Nouveau pack</button></div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {d.packs.map((p) => {
              const value = packValue(d, p)
              return (
                <button key={p.id} onClick={() => setPack(p)} className="card p-5 text-left cursor-pointer hover:shadow-lift transition">
                  <div className="flex -space-x-3 mb-4">{p.productIds.map((id) => { const x = d.products.find((y) => y.id === id)!; return <ProductVisual key={id} shape={x.shape} color={x.color} brand={x.brand} className="size-14 rounded-xl border-2 border-surface" /> })}</div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted">{p.tagline}</div>
                  <div className="flex items-end justify-between mt-4 pt-3 border-t border-line">
                    <div className="text-sm"><span className="text-soft line-through mr-1.5">{money(value)}</span><span className="font-semibold">{money(p.price)}</span></div>
                    <Badge tone="sage">Économie {money(value - p.price)}</Badge>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {tab === 'avis' && (
        <Card padded={false} title="Modération des avis" action={<Tabs value={String(ratingFilter)} onChange={(v) => setRatingFilter(+v)} tabs={[{ id: '0', label: 'Toutes' }, ...[5, 4, 3, 2, 1].map((n) => ({ id: String(n), label: `${n}★` }))]} />}>
          <ul className="divide-y divide-line">
            {reviews.map((r) => {
              const p = d.products.find((x) => x.id === r.productId)!
              return (
                <li key={r.id} className="px-5 py-4 flex gap-4">
                  <ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="size-12 rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><Stars value={r.rating} size={12} /><span className="text-sm font-medium">{r.title}</span>{r.status === 'en_attente' && <Badge tone="amber">À modérer</Badge>}{r.hasPhoto && <Badge tone="sky"><ImageIcon className="size-3" /> Photo</Badge>}</div>
                    <p className="text-sm text-muted mt-1">{r.text}</p>
                    <div className="text-[11px] text-soft mt-1">{r.author} · {date(r.date)} · {p.name}</div>
                  </div>
                  {r.status === 'en_attente' && (
                    <div className="flex gap-1.5 shrink-0">
                      <button className="btn-secondary btn-sm" onClick={() => { actions.moderateReview(r.id, true).then(() => toast('Avis publié')).catch(() => {}) }}><Check className="size-3.5" /> Publier</button>
                      <button className="btn-ghost btn-sm" onClick={() => { actions.moderateReview(r.id, false).then(() => toast('Avis refusé')).catch(() => {}) }}><X className="size-3.5" /></button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {tab === 'contenu' && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {d.articles.map((a) => (
            <Link key={a.id} to={`/boutique/conseils/${a.slug}`} target="_blank" className="card overflow-hidden hover:shadow-lift transition">
              <div className="h-24" style={{ background: `linear-gradient(135deg, ${a.cover}, #fbfaf7)` }} />
              <div className="p-4">
                <Badge tone="sage">{a.category}</Badge>
                <div className="font-medium mt-2 leading-snug">{a.title}</div>
                <div className="text-xs text-muted mt-2">/{a.slug} · {a.readTime} min · {date(a.date)}</div>
                <div className="text-[11px] text-sage-600 mt-2">SEO : titre {a.title.length} car. · meta {a.excerpt.length} car. {a.excerpt.length <= 160 ? '✓' : '⚠'}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {pack && <PackModal pack={pack} onClose={() => setPack(null)} />}
    </div>
  )
}

function PackModal({ pack, onClose }: { pack: Pack; onClose: () => void }) {
  const d = useData()
  const [p, setP] = useState(pack)
  const value = packValue(d, p)
  const toggle = (id: string) => setP({ ...p, productIds: p.productIds.includes(id) ? p.productIds.filter((x) => x !== id) : [...p.productIds, id] })
  const save = () => {
    if (!p.name || p.productIds.length < 2) return toast('Nom et au moins 2 produits requis')
    actions.savePack({ ...p, slug: p.slug || slugify(p.name), price: p.price || Math.round(value * 0.85), steps: p.productIds.map((id) => d.products.find((x) => x.id === id)!.subcategory) })
    toast('Pack enregistré'); onClose()
  }
  return (
    <Modal open wide onClose={onClose} title={pack.name || 'Nouveau pack / routine'} footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button><button className="btn-primary" onClick={save}>Enregistrer</button></>}>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <Field label="Nom"><input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="Routine Skin Care — Peau sèche" /></Field>
        <Field label="Type de routine"><select className="input" value={p.kind} onChange={(e) => setP({ ...p, kind: e.target.value as Pack['kind'] })}>{['visage', 'cheveux', 'imperfections', 'homme', 'bebe', 'solaire'].map((k) => <option key={k}>{k}</option>)}</select></Field>
        <Field label="Accroche"><input className="input" value={p.tagline} onChange={(e) => setP({ ...p, tagline: e.target.value })} /></Field>
        <Field label="Prix du pack (DH)" hint={`Valeur individuelle : ${money(value)} · économie ${money(Math.max(0, value - p.price))}`}><input type="number" className="input" value={p.price} onChange={(e) => setP({ ...p, price: +e.target.value })} /></Field>
        <Field label="Description" className="sm:col-span-2"><textarea rows={2} className="input" value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} /></Field>
      </div>
      <div className="text-sm font-medium mb-2">Produits ({p.productIds.length})</div>
      <div className="grid sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto scrollbar-thin">
        {d.products.map((x) => (
          <button key={x.id} onClick={() => toggle(x.id)} className={cx('flex items-center gap-2 rounded-lg border p-1.5 text-left cursor-pointer', p.productIds.includes(x.id) ? 'border-sage-500 bg-sage-50' : 'border-line hover:border-sage-300')}>
            <ProductVisual shape={x.shape} color={x.color} brand={x.brand} className="size-8 rounded-md" />
            <span className="text-xs flex-1 truncate">{x.name}</span><span className="text-[11px] text-muted">{money(x.price)}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
