import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Baby, Briefcase, Droplets, Flower2, Heart, Leaf, Palette, Pill, ShieldCheck, Smile, Sparkles, SprayCan, Sun, Truck, User, Wind } from 'lucide-react'

const CAT_ICONS: Record<string, typeof Leaf> = { Sparkles, Flower2, Wind, Droplets, Baby, Sun, Palette, SprayCan, Pill, Smile, User, Heart, Briefcase }
import { useData, useShop, useShopCustomer, useTenant } from '../../lib/store'
import { BRANDS, CATEGORIES } from '../../data/catalog'
import { date, money } from '../../lib/format'
import { bestSellerIds, complementary, isLive, packValue, priceOf } from '../../lib/logic'
import { ProductCard } from '../../components/ProductCard'
import { ProductVisual } from '../../components/ProductVisual'
import { Countdown } from '../../components/ui'
import { SmartSearch } from '../../layouts/ShopLayout'
import type { Product } from '../../lib/types'

export function Section({ title, eyebrow, to, children }: { title: string; eyebrow?: string; to?: string; children: React.ReactNode }) {
  return (
    <section className="max-w-7xl mx-auto px-4 mt-16">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          {eyebrow && <div className="text-[11px] uppercase tracking-[0.16em] text-champagne-600 mb-1">{eyebrow}</div>}
          <h2 className="text-2xl md:text-3xl">{title}</h2>
        </div>
        {to && <Link to={to} className="text-sm text-sage-600 hover:underline flex items-center gap-1 shrink-0">Tout voir <ArrowRight className="size-4" /></Link>}
      </div>
      {children}
    </section>
  )
}

export const Grid = ({ products }: { products: Product[] }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
)

export default function ShopHome() {
  const d = useData()
  const t = useTenant()
  const shop = useShop()
  const me = useShopCustomer()
  const active = d.products.filter((p) => p.active)
  const best = useMemo(() => bestSellerIds(d, 8).map((id) => d.products.find((p) => p.id === id)!).filter((p) => p?.active), [d])
  const promos = active.filter((p) => priceOf(d, p).oldPrice).slice(0, 8)
  const news = [...active].filter((p) => p.isNew).concat(active.slice(-4)).slice(0, 4)
  const recent = shop.recentlyViewed.map((id) => d.products.find((p) => p.id === id)!).filter(Boolean).slice(0, 4)
  const seed = recent[0] ?? (me?.customer.favorites[0] ? d.products.find((p) => p.id === me.customer.favorites[0]) : undefined) ?? best[0]
  const reco = seed ? complementary(d, seed, 4) : []
  const flash = d.promotions.find((p) => isLive(p) && (p.highlight || p.type === 'flash'))
  const hero = [d.products[2], d.products[26], d.products[3]]

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sage-100 via-cream to-champagne-100" />
        <div className="absolute -right-20 -top-20 size-96 rounded-full bg-white/50 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 py-14 md:py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 chip bg-surface/80 text-sage-700 border border-sage-200 h-7 px-3"><Leaf className="size-3.5" /> Dermo-cosmétique sélectionnée par nos pharmaciens</div>
            <h1 className="text-4xl md:text-6xl leading-[1.05] mt-5">La beauté qui prend <em className="text-sage-600 not-italic font-display italic">soin</em> de vous.</h1>
            <p className="text-muted mt-5 max-w-md text-lg">{t.tagline}. Plus de {active.length * 20} références, des routines conseillées et la livraison en 24 h.</p>
            <div className="mt-7 max-w-md hidden md:block"><SmartSearch big /></div>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link to="/boutique/quiz" className="btn-primary h-12 px-6"><Sparkles className="size-4" /> Trouver ma routine</Link>
              <Link to="/boutique/catalogue" className="btn-secondary h-12 px-6">Explorer la boutique</Link>
            </div>
          </div>
          <div className="relative h-80 md:h-[420px]">
            <div className="absolute left-[8%] top-[10%] w-[46%] rotate-[-6deg] rounded-[2rem] overflow-hidden shadow-lift bg-surface"><ProductVisual shape={hero[0].shape} color={hero[0].color} brand={hero[0].brand} className="w-full" /></div>
            <div className="absolute right-[4%] top-0 w-[44%] rotate-[5deg] rounded-[2rem] overflow-hidden shadow-lift bg-surface"><ProductVisual shape={hero[1].shape} color={hero[1].color} brand={hero[1].brand} className="w-full" /></div>
            <div className="absolute left-[30%] bottom-0 w-[42%] rounded-[2rem] overflow-hidden shadow-lift bg-surface"><ProductVisual shape={hero[2].shape} color={hero[2].color} brand={hero[2].brand} className="w-full" /></div>
            <div className="absolute right-[6%] bottom-[12%] card px-4 py-3 shadow-lift"><div className="text-xs text-muted">Note moyenne</div><div className="font-semibold">★ 4,7 / 5 · 2 400 avis</div></div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 -mt-6 relative">
        <div className="card grid grid-cols-2 md:grid-cols-4 divide-x divide-line">
          {[[Truck, 'Livraison 24–72 h', 'Offerte dès 400 DH'], [ShieldCheck, 'Produits authentiques', 'Circuit pharmaceutique'], [BadgeCheck, 'Conseil expert', 'Chat avec nos conseillers'], [Sparkles, 'Fidélité récompensée', '1 point / 10 DH']].map(([I, a, b]) => {
            const Icon = I as typeof Truck
            return <div key={a as string} className="flex items-center gap-3 p-4"><Icon className="size-5 text-sage-500 shrink-0" /><div><div className="text-sm font-medium">{a as string}</div><div className="text-xs text-muted">{b as string}</div></div></div>
          })}
        </div>
      </div>

      <Section title="Explorer par catégorie" eyebrow="Catégories">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {CATEGORIES.slice(0, 14).map((c) => {
            const Icon = CAT_ICONS[c.icon] ?? Leaf
            return (
              <Link key={c.id} to={`/boutique/catalogue?cat=${c.id}`} className="group card p-4 text-center transition hover:-translate-y-0.5 hover:shadow-lift">
                <span className="mx-auto size-12 rounded-2xl grid place-items-center transition group-hover:scale-110" style={{ background: c.tint }}><Icon className="size-5 text-sage-700" strokeWidth={1.5} /></span>
                <div className="text-xs font-medium mt-2.5 leading-tight">{c.label}</div>
              </Link>
            )
          })}
        </div>
      </Section>

      {flash && (
        <section className="max-w-7xl mx-auto px-4 mt-16">
          <div className="rounded-[2rem] bg-gradient-to-r from-champagne-100 via-cream to-sage-100 border border-champagne-200 p-8 md:p-10 grid md:grid-cols-2 gap-6 items-center">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-champagne-600">Offre limitée</div>
              <h2 className="text-3xl mt-2">{flash.name}</h2>
              <p className="text-muted mt-2">Profitez-en avant la fin du compte à rebours.</p>
              <div className="mt-5"><Countdown to={flash.endsAt} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">{active.filter((p) => { const pi = priceOf(d, p); return pi.endsAt === flash.endsAt }).slice(0, 2).map((p) => <ProductCard key={p.id} p={p} compact />)}</div>
          </div>
        </section>
      )}

      {promos.length > 0 && <Section title="Promotions du moment" eyebrow="Jusqu’à −30 %" to="/boutique/catalogue?promo=1"><Grid products={promos.slice(0, 4)} /></Section>}
      <Section title="Meilleures ventes" eyebrow="Plébiscités par nos clients" to="/boutique/catalogue?tri=ventes"><Grid products={best.slice(0, 4)} /></Section>

      <Section title="Routines & packs" eyebrow="Économisez jusqu’à 20 %" to="/boutique/routines">
        <div className="grid md:grid-cols-3 gap-4">
          {d.packs.slice(0, 3).map((pk) => (
            <Link key={pk.id} to={`/boutique/routines#${pk.slug}`} className="card p-6 hover:shadow-lift transition group">
              <div className="flex -space-x-4">{pk.productIds.map((id) => { const p = d.products.find((x) => x.id === id)!; return <ProductVisual key={id} shape={p.shape} color={p.color} brand={p.brand} className="size-16 rounded-2xl border-2 border-surface shadow-soft" /> })}</div>
              <div className="font-display text-lg mt-4">{pk.name}</div>
              <div className="text-sm text-muted">{pk.steps.join(' + ')}</div>
              <div className="flex items-center gap-2 mt-4"><span className="font-semibold">{money(pk.price)}</span><span className="text-sm text-soft line-through">{money(packValue(d, pk))}</span><span className="chip bg-sage-100 text-sage-700 ml-auto">−{money(packValue(d, pk) - pk.price)}</span></div>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Nouveautés" eyebrow="Fraîchement arrivés" to="/boutique/catalogue?tri=nouveautes"><Grid products={news} /></Section>

      <section className="max-w-7xl mx-auto px-4 mt-16">
        <div className="rounded-[2rem] bg-sage-800 text-white p-8 md:p-12 grid md:grid-cols-2 gap-8 items-center overflow-hidden relative">
          <div className="absolute -right-10 -bottom-16 size-72 rounded-full bg-sage-600/40" />
          <div className="relative">
            <div className="text-[11px] uppercase tracking-[0.16em] text-champagne-200">Quiz beauté · 1 minute</div>
            <h2 className="text-3xl md:text-4xl mt-2">Trouvez votre routine idéale</h2>
            <p className="text-sage-100 mt-3">6 questions sur votre peau, vos habitudes et votre budget. Nous vous proposons une sélection sur mesure.</p>
            <Link to="/boutique/quiz" className="btn-gold h-12 px-6 mt-6">Commencer le quiz <ArrowRight className="size-4" /></Link>
          </div>
          <ul className="relative grid grid-cols-2 gap-3 text-sm">
            {['Type de peau', 'Préoccupation', 'Âge', 'Sensibilité', 'Habitudes', 'Budget'].map((s, i) => <li key={s} className="rounded-xl bg-white/10 border border-white/10 px-4 py-3"><span className="text-champagne-200 mr-2">{i + 1}.</span>{s}</li>)}
          </ul>
        </div>
      </section>

      {reco.length > 0 && <Section title={me ? `Recommandé pour vous, ${me.customer.firstName}` : 'Produits recommandés'} eyebrow="Sélection personnalisée"><Grid products={reco} /></Section>}

      <Section title="Marques populaires" eyebrow="Nos laboratoires">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {BRANDS.slice(0, 12).map((b) => (
            <Link key={b.name} to={`/boutique/catalogue?marque=${encodeURIComponent(b.name)}`} className="card h-24 grid place-items-center text-center px-3 hover:shadow-lift transition">
              <div><div className="font-display text-lg">{b.name}</div><div className="text-[10px] text-muted mt-0.5">{b.tagline}</div></div>
            </Link>
          ))}
        </div>
      </Section>

      {recent.length > 0 && <Section title="Récemment consultés"><Grid products={recent} /></Section>}

      <Section title="Conseils de nos experts" eyebrow="Le journal" to="/boutique/conseils">
        <div className="grid md:grid-cols-3 gap-4">
          {d.articles.slice(0, 3).map((a) => (
            <Link key={a.id} to={`/boutique/conseils/${a.slug}`} className="card overflow-hidden group hover:shadow-lift transition">
              <div className="h-40 relative" style={{ background: `linear-gradient(135deg, ${a.cover}, #fbfaf7)` }}>
                {(() => { const p = d.products.find((x) => x.id === a.productIds[0]); return p && <ProductVisual shape={p.shape} color={p.color} brand={p.brand} bg={false} className="absolute right-4 bottom-0 h-36 transition group-hover:scale-105" /> })()}
              </div>
              <div className="p-5"><div className="text-[11px] uppercase tracking-[0.14em] text-champagne-600">{a.category} · {a.readTime} min</div><div className="font-display text-lg mt-1.5 leading-snug">{a.title}</div><div className="text-xs text-soft mt-2">{date(a.date)}</div></div>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  )
}
