import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, BarChart3, Boxes, Building2, CalendarClock, Check, ChevronDown, CreditCard, Crown, Gift, LayoutDashboard,
  Megaphone, Monitor, Package, ScanBarcode, ShieldCheck, ShoppingBag, Sparkles, Store, Truck, Users,
} from 'lucide-react'
import { PLANS } from '../../data/plans'
import { PRODUCT_ROWS } from '../../data/catalog'
import { money } from '../../lib/format'
import { Logo } from '../../components/Logo'
import { ProductVisual } from '../../components/ProductVisual'
import { Field, Tabs, cx, toast } from '../../components/ui'

const P = (i: number) => { const r = PRODUCT_ROWS[i]; return { name: r[0], brand: r[1], shape: r[4], color: r[5], price: r[8] } }
// Lightweight SVG sparkline so the marketing page doesn't pull in the charting library.
function Spark({ data, height = 60, color = '#5f7d68' }: { data: number[]; height?: number; color?: string }) {
  const max = Math.max(...data), min = Math.min(...data)
  const pts = data.map((v, i) => [(i / (data.length - 1)) * 100, 100 - ((v - min) / (max - min || 1)) * 90 - 5])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')
  const id = 'lg' + color.slice(1)
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} className="w-full">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L100,100 L0,100 Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const trend = [42, 48, 45, 52, 58, 55, 61, 66, 63, 71, 76, 74, 82, 88, 85, 93]

function Frame({ children, url = 'app.paraflow.ma/admin', className }: { children: React.ReactNode; url?: string; className?: string }) {
  return (
    <div className={cx('rounded-2xl border border-line bg-white shadow-[0_30px_80px_-20px_rgb(31_38_34/0.25)] overflow-hidden', className)}>
      <div className="h-9 flex items-center gap-1.5 px-4 border-b border-line bg-ivory">
        <span className="size-2.5 rounded-full bg-[#e9b8ae]" /><span className="size-2.5 rounded-full bg-[#ecd9a8]" /><span className="size-2.5 rounded-full bg-[#b9ccb9]" />
        <span className="ml-4 text-[10px] text-soft bg-white border border-line rounded-md px-3 py-0.5">{url}</span>
      </div>
      {children}
    </div>
  )
}

function DashboardMock() {
  return (
    <Frame>
      <div className="grid grid-cols-[150px_1fr] min-h-[380px] text-[11px]">
        <div className="border-r border-line p-3 space-y-1 hidden sm:block">
          <div className="flex items-center gap-2 mb-3"><Logo /></div>
          {[[LayoutDashboard, 'Dashboard'], [ShoppingBag, 'Commandes'], [Package, 'Produits'], [Boxes, 'Stock'], [CalendarClock, 'Lots'], [Users, 'Clients'], [Monitor, 'POS'], [BarChart3, 'Analytics']].map(([I, l], i) => {
            const Icon = I as typeof Package
            return <div key={l as string} className={cx('flex items-center gap-2 px-2 py-1.5 rounded-md', i === 0 ? 'bg-sage-600 text-white' : 'text-muted')}><Icon className="size-3" />{l as string}</div>
          })}
        </div>
        <div className="p-4 bg-ivory">
          <div className="font-display text-base">Bonjour, Nadia</div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {[['CA 30 j', '486 250 DH', '+12,4 %'], ['Commandes du jour', '58', '+8 %'], ['Panier moyen', '312 DH', '+3,1 %'], ['Stock faible', '8', '']].map(([l, v, d]) => (
              <div key={l} className="rounded-lg bg-white border border-line p-2"><div className="text-[9px] text-muted">{l}</div><div className="font-semibold text-[13px] mt-0.5">{v}</div>{d && <div className="text-[9px] text-sage-600">{d}</div>}</div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="col-span-2 rounded-lg bg-white border border-line p-2"><div className="text-[10px] font-medium mb-1">Chiffre d’affaires</div><Spark data={trend} height={110} /></div>
            <div className="rounded-lg bg-white border border-line p-2 space-y-1.5">
              <div className="text-[10px] font-medium">Alertes importantes</div>
              <div className="rounded-md bg-amber-soft text-amber-ink px-2 py-1 text-[9px]">8 produits sous le seuil</div>
              <div className="rounded-md bg-rose-soft text-rose-ink px-2 py-1 text-[9px]">12 produits expirent bientôt</div>
              <div className="rounded-md bg-sky-soft text-sky-ink px-2 py-1 text-[9px]">14 commandes à préparer</div>
            </div>
          </div>
          <div className="rounded-lg bg-white border border-line p-2 mt-2">
            <div className="text-[10px] font-medium mb-1">Meilleures ventes</div>
            {[2, 26, 0].map((i) => { const p = P(i); return <div key={i} className="flex items-center gap-2 py-1"><ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="size-6 rounded" /><span className="flex-1 truncate">{p.name}</span><span className="text-muted">{money(p.price)}</span></div> })}
          </div>
        </div>
      </div>
    </Frame>
  )
}

function PhoneMock() {
  return (
    <div className="w-[250px] rounded-[2.4rem] border-[7px] border-ink bg-ivory shadow-[0_30px_60px_-15px_rgb(31_38_34/0.35)] overflow-hidden">
      <div className="h-5 bg-ink mx-auto w-24 rounded-b-xl" />
      <div className="p-3 text-[10px]">
        <div className="font-display text-sm">Parapharmacie Sève</div>
        <div className="mt-2 rounded-full border border-line bg-white px-3 py-1.5 text-soft">Rechercher « peau sèche »…</div>
        <div className="mt-3 rounded-2xl bg-gradient-to-br from-sage-100 to-champagne-100 p-3"><div className="font-display text-sm leading-tight">La beauté qui prend soin de vous</div><div className="mt-2 inline-block rounded-full bg-sage-600 text-white px-2 py-0.5">Trouver ma routine</div></div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {[4, 26, 17, 12].map((i) => { const p = P(i); return <div key={i} className="rounded-xl bg-white border border-line overflow-hidden"><ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="w-full aspect-square" /><div className="p-1.5"><div className="truncate">{p.name}</div><div className="font-semibold">{money(p.price)}</div></div></div> })}
        </div>
      </div>
    </div>
  )
}

const FEATURES = [
  { icon: LayoutDashboard, title: 'Dashboard en temps réel', text: 'CA, marges, commandes, alertes stock et expirations sur un seul écran.' },
  { icon: Boxes, title: 'Stock par lot & expiration', text: 'Entrées, sorties, transferts, inventaires et règle FEFO automatique.' },
  { icon: Monitor, title: 'Caisse POS', text: 'Scan code-barres, remises, fidélité, retours et clôture de caisse.' },
  { icon: Store, title: 'Boutique en ligne', text: 'E-commerce élégant, recherche par besoin, packs et routines.' },
  { icon: Users, title: 'CRM & segmentation', text: 'Historique, valeur client, segments VIP, réguliers, inactifs.' },
  { icon: Gift, title: 'Fidélité', text: 'Points, niveaux Basic → VIP, récompenses et bons d’achat.' },
  { icon: Megaphone, title: 'Marketing automatisé', text: 'Relance panier abandonné, campagnes email/SMS, alertes prix.' },
  { icon: Truck, title: 'Livraisons', text: 'Zones, tarifs, express, gratuité et connecteurs transporteurs.' },
  { icon: Package, title: 'Achats fournisseurs', text: 'Bons de commande, réceptions partielles, factures, réassort suggéré.' },
  { icon: BarChart3, title: 'Analytics avancés', text: 'Conversion, rotation du stock, LTV, fidélisation.' },
  { icon: Building2, title: 'Multi-boutiques', text: 'Stock, caisse et équipe par magasin, vue direction consolidée.' },
  { icon: ShieldCheck, title: 'Rôles & permissions', text: 'Le vendeur vend, sans voir vos prix d’achat.' },
]

const FAQ = [
  ['Mes données sont-elles isolées des autres parapharmacies ?', 'Oui. Chaque parapharmacie dispose de son propre espace : toutes les données (catalogue, stock, clients, ventes) sont cloisonnées par tenant au niveau de la base de données. Aucune donnée n’est accessible d’une entreprise à une autre.'],
  ['Puis-je importer mon catalogue et mon stock existants ?', 'Oui, par import Excel/CSV (références, codes-barres, lots, dates d’expiration). Notre équipe vous accompagne gratuitement pour la migration.'],
  ['La caisse fonctionne-t-elle avec mon matériel ?', 'Le POS fonctionne dans le navigateur, sur PC ou tablette, avec les douchettes code-barres USB/Bluetooth et les imprimantes ticket standard.'],
  ['Le stock est-il synchronisé entre la boutique et le site ?', 'En temps réel : une vente en caisse ou une commande web met à jour le stock disponible immédiatement, avec réservation des commandes en cours de préparation.'],
  ['Y a-t-il un engagement ?', 'Non. L’abonnement est mensuel et sans engagement, avec 14 jours d’essai gratuit sans carte bancaire.'],
  ['Proposez-vous une application mobile ?', 'L’architecture API est prête pour les applications client (catalogue, commandes, fidélité) et employé (POS, stock, préparation). Elles sont sur notre feuille de route.'],
]

export default function Landing() {
  const nav = useNavigate()
  const [cycle, setCycle] = useState<'mois' | 'an'>('mois')
  const [faq, setFaq] = useState(0)
  const [demo, setDemo] = useState({ name: '', pharmacy: '', city: '', phone: '' })

  return (
    <div className="bg-ivory">
      <header className="sticky top-0 z-40 bg-ivory/85 backdrop-blur border-b border-line/60">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-8">
          <Link to="/"><Logo /></Link>
          <nav className="hidden md:flex gap-6 text-sm text-muted">
            <a href="#fonctionnalites" className="hover:text-ink">Fonctionnalités</a>
            <a href="#modules" className="hover:text-ink">Modules</a>
            <a href="#tarifs" className="hover:text-ink">Tarifs</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <div className="ml-auto flex gap-2">
            <Link to="/connexion" className="btn-ghost hidden sm:inline-flex">Connexion</Link>
            <Link to="/inscription" className="btn-primary">Essai gratuit</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-champagne-100),transparent_55%),radial-gradient(ellipse_at_top_left,var(--color-sage-100),transparent_50%)]" />
        <div className="relative max-w-7xl mx-auto px-4 pt-16 md:pt-24 pb-10 text-center">
          <div className="inline-flex items-center gap-2 chip h-7 px-3 bg-white border border-line text-muted"><Sparkles className="size-3.5 text-champagne-400" /> ERP · POS · CRM · E-commerce · Fidélité — une seule plateforme</div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl leading-[1.04] mt-6 max-w-4xl mx-auto">La gestion intelligente de votre <em className="italic text-sage-600">parapharmacie</em>.</h1>
          <p className="text-lg md:text-xl text-muted mt-6 max-w-2xl mx-auto">Stock, ventes, commandes, clients et boutique en ligne réunis dans une seule plateforme.</p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <Link to="/inscription" className="btn-primary h-12 px-6">Démarrer l’essai gratuit <ArrowRight className="size-4" /></Link>
            <Link to="/connexion" className="btn-secondary h-12 px-6">Explorer la démo</Link>
            <Link to="/boutique" className="btn-ghost h-12 px-6">Voir une boutique client</Link>
          </div>
          <div className="text-xs text-soft mt-4">14 jours gratuits · Sans carte bancaire · Sans engagement</div>
          <div className="relative mt-14 max-w-5xl mx-auto">
            <DashboardMock />
            <div className="hidden lg:block absolute -right-16 -bottom-10"><PhoneMock /></div>
            <div className="hidden md:flex absolute -left-10 bottom-16 card shadow-lift p-3 items-center gap-3 text-left animate-fade-up">
              <span className="size-9 rounded-xl bg-rose-soft text-rose-ink grid place-items-center"><CalendarClock className="size-4" /></span>
              <div><div className="text-xs font-medium">12 produits expirent bientôt</div><div className="text-[10px] text-muted">Suggestion : promo −30 % automatique</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[['−35 %', 'de pertes liées aux péremptions'], ['+22 %', 'de CA avec la boutique en ligne'], ['3 h', 'gagnées par semaine sur le stock'], ['1', 'plateforme au lieu de 5 outils']].map(([v, l]) => (
            <div key={l}><div className="font-display text-4xl md:text-5xl text-sage-700">{v}</div><div className="text-sm text-muted mt-2">{l}</div></div>
          ))}
        </div>
      </section>

      <section id="fonctionnalites" className="max-w-7xl mx-auto px-4 py-12">
        <div className="max-w-2xl">
          <div className="text-[11px] uppercase tracking-[0.16em] text-champagne-600">Présentation</div>
          <h2 className="text-3xl md:text-5xl mt-2">Tout votre métier, enfin réuni.</h2>
          <p className="text-muted mt-4 text-lg">Conçu avec des pharmaciens et gérants de parapharmacie, Paraflow remplace la caisse, les fichiers Excel de stock, l’outil e-commerce et le logiciel de fidélité — sans compromis sur la simplicité.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5 transition hover:shadow-lift hover:-translate-y-0.5">
              <span className="size-10 rounded-xl bg-sage-50 text-sage-600 grid place-items-center"><f.icon className="size-5" strokeWidth={1.6} /></span>
              <div className="font-medium mt-4">{f.title}</div>
              <p className="text-sm text-muted mt-1">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <div id="modules" className="space-y-24 py-16">
        <Showcase eyebrow="Gestion du stock" title="Chaque lot, chaque date d’expiration, sous contrôle." points={['Stock disponible, réservé, faible, en rupture', 'Vue « expire dans 7 / 30 / 60 / 90 jours »', 'Alertes automatiques et déstockage en un clic', 'Import / export Excel & CSV']}>
          <Frame url="app.paraflow.ma/admin/lots">
            <div className="p-4 space-y-2 text-xs">
              <div className="grid grid-cols-4 gap-2">{[['≤ 7 j', '4', 'text-rose-ink'], ['≤ 30 j', '12', 'text-amber-ink'], ['≤ 60 j', '19', 'text-ink'], ['≤ 90 j', '27', 'text-ink']].map(([l, v, c]) => <div key={l} className="rounded-lg border border-line p-2"><div className="text-[10px] text-muted">Expire {l}</div><div className={cx('text-lg font-semibold', c)}>{v} lots</div></div>)}</div>
              {[[1, 'L24185B', 'J-4', 'bg-rose-soft text-rose-ink'], [5, 'L24407F', 'J-18', 'bg-amber-soft text-amber-ink'], [9, 'L24629J', 'J-41', 'bg-champagne-100 text-champagne-600']].map(([i, lot, j, c]) => { const p = P(i as number); return (
                <div key={lot as string} className="flex items-center gap-3 rounded-lg border border-line p-2"><ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="size-8 rounded" /><div className="flex-1"><div className="font-medium">{p.name}</div><div className="text-[10px] text-muted font-mono">{lot as string} · Meknès · 14 u.</div></div><span className={cx('chip', c as string)}>{j as string}</span></div>
              ) })}
            </div>
          </Frame>
        </Showcase>
        <Showcase reverse eyebrow="E-commerce" title="Une boutique en ligne à la hauteur de votre enseigne." points={['Recherche intelligente : nom, marque, besoin, référence', 'Fiches premium, avis, produits complémentaires', 'Packs & routines avec économie affichée', 'Quiz beauté et chat conseiller intégré']}>
          <div className="flex justify-center"><PhoneMock /></div>
        </Showcase>
        <Showcase eyebrow="Caisse POS" title="Encaissez vite, sans jamais désynchroniser le stock." points={['Scan code-barres et recherche instantanée', 'Remises contrôlées par les permissions', 'Retours, échanges et avoirs', 'Clôture de caisse et rapport Z']}>
          <Frame url="app.paraflow.ma/admin/pos">
            <div className="grid grid-cols-5 text-xs">
              <div className="col-span-3 p-3 grid grid-cols-3 gap-2 bg-ivory">
                <div className="col-span-3 rounded-lg border border-line bg-white px-2 py-1.5 flex items-center gap-2 text-soft"><ScanBarcode className="size-3.5 text-sage-500" /> 6113000104729</div>
                {[0, 2, 26, 43, 19, 11].map((i) => { const p = P(i); return <div key={i} className="rounded-lg bg-white border border-line p-1.5"><ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="w-full aspect-[4/3] rounded" /><div className="truncate mt-1">{p.name}</div><div className="font-semibold">{money(p.price)}</div></div> })}
              </div>
              <div className="col-span-2 p-3 border-l border-line flex flex-col">
                <div className="font-medium">Ticket</div>
                {[0, 26].map((i) => { const p = P(i); return <div key={i} className="flex justify-between py-1.5 border-b border-line"><span className="truncate pr-2">{p.name}</span><span>{money(p.price)}</span></div> })}
                <div className="mt-auto pt-3 flex justify-between font-semibold text-sm"><span>Total</span><span>{money(P(0).price + P(26).price)}</span></div>
                <div className="grid grid-cols-2 gap-1.5 mt-2"><span className="rounded-md bg-sage-600 text-white text-center py-1.5"><CreditCard className="size-3 inline" /> Carte</span><span className="rounded-md bg-champagne-400 text-white text-center py-1.5">Espèces</span></div>
              </div>
            </div>
          </Frame>
        </Showcase>
        <Showcase reverse eyebrow="CRM & fidélité" title="Connaissez vos clientes, récompensez leur fidélité." points={['Historique, panier moyen, produits favoris', 'Segments : nouveaux, réguliers, VIP, inactifs', '10 DH dépensés = 1 point, niveaux Basic → VIP', 'Relances et campagnes ciblées']}>
          <div className="relative max-w-md mx-auto">
            <div className="rounded-[2rem] p-7 text-white bg-gradient-to-br from-sage-600 to-sage-800 shadow-lift">
              <div className="flex justify-between"><div><div className="text-[10px] uppercase tracking-[0.16em] text-white/70">Carte fidélité</div><div className="font-display text-2xl mt-1 flex items-center gap-2"><Crown className="size-5 text-champagne-200" /> Gold</div></div><div className="text-right"><div className="text-3xl font-semibold">1 240</div><div className="text-[10px] text-white/70">points</div></div></div>
              <div className="mt-8 h-2 rounded-full bg-white/20"><div className="h-full w-3/4 rounded-full bg-champagne-200" /></div>
              <div className="text-[11px] text-white/80 mt-2">Encore 2 150 DH pour devenir VIP</div>
            </div>
            <div className="card shadow-lift p-4 -mt-6 mx-6 relative text-sm flex items-center gap-3"><span className="size-9 rounded-full bg-champagne-100 text-champagne-600 grid place-items-center font-semibold text-xs">SB</span><div className="flex-1"><div className="font-medium">Salma Benali</div><div className="text-xs text-muted">18 commandes · panier moyen 342 DH</div></div><span className="chip bg-champagne-100 text-champagne-600">VIP</span></div>
          </div>
        </Showcase>
        <Showcase eyebrow="Multi-boutiques & analytics" title="Pilotez tout votre réseau depuis un seul tableau de bord." points={['Meknès, Fès, Rabat… chacune avec son stock, sa caisse, son équipe', 'Comparatif des performances par magasin', 'Conversion, rotation du stock, LTV, fidélisation', 'Finance : marge, dépenses, bénéfice estimé']}>
          <Frame url="app.paraflow.ma/admin/boutiques">
            <div className="p-4 grid grid-cols-3 gap-2 text-xs bg-ivory">
              {[['Sève Meknès', '212 480 DH', '+9 %', 44], ['Sève Fès', '148 900 DH', '+14 %', 31], ['Sève Rabat', '124 870 DH', '+21 %', 25]].map(([n, v, d, s]) => (
                <div key={n as string} className="rounded-lg bg-white border border-line p-3"><div className="font-display text-sm">{n}</div><div className="font-semibold text-base mt-2">{v}</div><div className="text-sage-600 text-[10px]">{d} vs mois préc.</div><div className="h-1.5 rounded-full bg-cream mt-2"><div className="h-full rounded-full bg-sage-500" style={{ width: `${(s as number) * 2}%` }} /></div><div className="text-[10px] text-muted mt-1">{s} % du CA</div></div>
              ))}
              <div className="col-span-3 rounded-lg bg-white border border-line p-2"><Spark data={[...trend].reverse().map((x, i) => x + (i % 3) * 6)} height={90} color="#c9a96e" /></div>
            </div>
          </Frame>
        </Showcase>
      </div>

      <section id="tarifs" className="bg-cream border-y border-line py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.16em] text-champagne-600">Tarifs</div>
            <h2 className="text-3xl md:text-5xl mt-2">Un plan pour chaque parapharmacie</h2>
            <div className="mt-6 inline-flex"><Tabs value={cycle} onChange={setCycle} tabs={[{ id: 'mois', label: 'Mensuel' }, { id: 'an', label: 'Annuel · 2 mois offerts' }]} /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-5 mt-10">
            {PLANS.map((p) => (
              <div key={p.id} className={cx('card p-7 flex flex-col relative', p.id === 'pro' && 'ring-2 ring-sage-500 md:-translate-y-3')}>
                {p.id === 'pro' && <span className="absolute -top-3 left-1/2 -translate-x-1/2 chip bg-sage-600 text-white h-6 px-3">Le plus choisi</span>}
                <div className="font-display text-2xl">{p.name}</div>
                <p className="text-sm text-muted mt-1 min-h-10">{p.description}</p>
                <div className="mt-5"><span className="text-4xl font-semibold">{money(cycle === 'mois' ? p.price : Math.round(p.yearly / 12))}</span><span className="text-muted text-sm"> / mois HT</span></div>
                {cycle === 'an' && <div className="text-xs text-sage-600">soit {money(p.yearly)} facturés par an</div>}
                <div className="text-xs text-muted mt-3">{p.limits.stores} boutique{p.limits.stores > 1 ? 's' : ''} · {p.limits.users} utilisateurs · {p.limits.products.toLocaleString('fr-FR')} produits</div>
                <ul className="mt-5 space-y-2.5 text-sm flex-1">{p.features.map((f) => <li key={f} className="flex gap-2"><Check className="size-4 text-sage-500 mt-0.5 shrink-0" />{f}</li>)}</ul>
                <Link to={`/inscription?plan=${p.id}`} className={cx('mt-7 h-11', p.id === 'pro' ? 'btn-primary' : 'btn-secondary')}>Essayer 14 jours gratuits</Link>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted mt-6">* Au-delà de 20 boutiques, contactez-nous pour une offre réseau / franchise.</p>
        </div>
      </section>

      <section id="faq" className="max-w-3xl mx-auto px-4 py-20">
        <h2 className="text-3xl md:text-5xl text-center">Questions fréquentes</h2>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {FAQ.map(([q, a], i) => (
            <div key={q}>
              <button onClick={() => setFaq(faq === i ? -1 : i)} className="w-full flex justify-between items-center gap-4 py-5 text-left font-medium cursor-pointer">{q}<ChevronDown className={cx('size-4 shrink-0 transition', faq === i && 'rotate-180')} /></button>
              {faq === i && <p className="pb-5 text-muted leading-relaxed animate-fade-up">{a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section id="demo" className="max-w-6xl mx-auto px-4 pb-20">
        <div className="rounded-[2rem] bg-sage-800 text-white p-8 md:p-14 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-champagne-200">Démonstration</div>
            <h2 className="text-3xl md:text-4xl mt-2">Voyez Paraflow avec vos propres produits.</h2>
            <p className="text-sage-100 mt-4">30 minutes avec un expert, en visio ou dans votre parapharmacie. Nous importons un extrait de votre catalogue pour une démo sur mesure.</p>
            <ul className="mt-6 space-y-2 text-sm text-sage-100">{['Migration de vos données offerte', 'Formation de votre équipe incluse', 'Support basé au Maroc, en français et en arabe'].map((x) => <li key={x} className="flex gap-2"><Check className="size-4 text-champagne-200" />{x}</li>)}</ul>
          </div>
          <form className="bg-white text-ink rounded-2xl p-6 space-y-3" onSubmit={(e) => { e.preventDefault(); if (!demo.name || !demo.phone) return toast('Nom et téléphone requis'); toast('Merci ! Un expert vous rappelle sous 24 h.'); setDemo({ name: '', pharmacy: '', city: '', phone: '' }) }}>
            <Field label="Nom complet"><input className="input" value={demo.name} onChange={(e) => setDemo({ ...demo, name: e.target.value })} /></Field>
            <Field label="Parapharmacie"><input className="input" value={demo.pharmacy} onChange={(e) => setDemo({ ...demo, pharmacy: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ville"><input className="input" value={demo.city} onChange={(e) => setDemo({ ...demo, city: e.target.value })} /></Field>
              <Field label="Téléphone"><input type="tel" className="input" value={demo.phone} onChange={(e) => setDemo({ ...demo, phone: e.target.value })} /></Field>
            </div>
            <button className="btn-primary w-full h-11">Demander une démo</button>
            <button type="button" className="btn-ghost w-full" onClick={() => nav('/connexion')}>ou explorer la démo en ligne maintenant →</button>
          </form>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-7xl mx-auto px-4 py-10 flex flex-wrap justify-between gap-6 text-sm text-muted">
          <div><Logo /><p className="mt-3 max-w-xs">La plateforme tout-en-un des parapharmacies modernes.</p></div>
          <div className="flex gap-10">
            <div className="space-y-2"><div className="text-ink font-medium">Produit</div><a href="#fonctionnalites" className="block">Fonctionnalités</a><a href="#tarifs" className="block">Tarifs</a><Link to="/connexion" className="block">Démo</Link></div>
            <div className="space-y-2"><div className="text-ink font-medium">Entreprise</div><Link to="/console" className="block">Console opérateur</Link><a href="#demo" className="block">Contact</a><span className="block">Confidentialité</span></div>
          </div>
        </div>
        <div className="text-center text-xs text-soft pb-8">© {new Date().getFullYear()} Paraflow. Tous droits réservés.</div>
      </footer>
    </div>
  )
}

function Showcase({ eyebrow, title, points, children, reverse }: { eyebrow: string; title: string; points: string[]; children: React.ReactNode; reverse?: boolean }) {
  return (
    <section className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
      <div className={cx(reverse && 'lg:order-2')}>
        <div className="text-[11px] uppercase tracking-[0.16em] text-champagne-600">{eyebrow}</div>
        <h3 className="text-3xl md:text-4xl mt-2 leading-tight">{title}</h3>
        <ul className="mt-6 space-y-3">{points.map((p) => <li key={p} className="flex gap-3 text-muted"><span className="size-5 rounded-full bg-sage-100 text-sage-700 grid place-items-center shrink-0 mt-0.5"><Check className="size-3" /></span>{p}</li>)}</ul>
      </div>
      <div className={cx(reverse && 'lg:order-1')}>{children}</div>
    </section>
  )
}

