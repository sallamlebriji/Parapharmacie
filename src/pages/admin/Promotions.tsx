import { useState } from 'react'
import { Plus, Timer } from 'lucide-react'
import { actions, useData } from '../../lib/store'
import { CATEGORIES } from '../../data/catalog'
import { CATEGORY_LABEL } from '../../data/plans'
import { date, daysFromNow, iso, money, uid } from '../../lib/format'
import { isLive } from '../../lib/logic'
import { Badge, Countdown, Field, Modal, PageHeader, Tabs, Toggle, cx, toast } from '../../components/ui'
import type { PromoType, Promotion } from '../../lib/types'

export const PROMO_TYPES: Record<PromoType, { label: string; hint: string }> = {
  pourcentage: { label: 'Code promo %', hint: 'Réduction en pourcentage via un code' },
  fixe: { label: 'Réduction fixe', hint: 'Montant en DH via un code' },
  categorie: { label: 'Promotion catégorie', hint: 'Toute une catégorie en promotion' },
  marque: { label: 'Promotion marque', hint: 'Toute une marque en promotion' },
  bxgy: { label: 'Achetez X, obtenez Y', hint: 'Ex. 2 achetés = 1 offert' },
  flash: { label: 'Offre limitée (flash)', hint: 'Un produit, durée courte, compte à rebours' },
  saisonniere: { label: 'Promotion saisonnière', hint: 'Code saisonnier avec minimum d’achat' },
}

const describe = (p: Promotion, name: (id: string) => string) => {
  switch (p.type) {
    case 'categorie': return `−${p.value} % sur ${CATEGORY_LABEL[p.target!]}`
    case 'marque': return `−${p.value} % sur ${p.target}`
    case 'bxgy': return `${p.buyX} achetés + ${p.getY} offert — ${name(p.target!)}`
    case 'flash': return `−${p.value} % sur ${name(p.target!)}`
    case 'fixe': return `−${money(p.value)}${p.minAmount ? ` dès ${money(p.minAmount)}` : ''}`
    default: return `−${p.value} %${p.minAmount ? ` dès ${money(p.minAmount)}` : ''}`
  }
}

export default function Promotions() {
  const d = useData()
  const [tab, setTab] = useState<'live' | 'future' | 'past' | 'all'>('live')
  const [edit, setEdit] = useState<Promotion | null>(null)
  const name = (id: string) => d.products.find((p) => p.id === id)?.name ?? id
  const now = Date.now()
  const state = (p: Promotion) => isLive(p) ? 'live' : new Date(p.startsAt).getTime() > now && p.active ? 'future' : 'past'
  const list = d.promotions.filter((p) => tab === 'all' || state(p) === tab)
  const featured = d.promotions.filter((p) => isLive(p) && (p.highlight || p.type === 'flash'))

  return (
    <div>
      <PageHeader title="Promotions" subtitle="Codes promo, remises catégorie/marque, Buy X Get Y, offres flash et saisonnières." actions={<button className="btn-primary" onClick={() => setEdit({ id: uid('pr'), name: '', type: 'pourcentage', value: 10, code: '', startsAt: iso(new Date()), endsAt: iso(daysFromNow(14)), active: true, uses: 0 })}><Plus className="size-4" /> Nouvelle promotion</button>} />
      {featured.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4 mb-5">
          {featured.map((p) => (
            <div key={p.id} className="rounded-2xl p-5 bg-gradient-to-br from-champagne-100 via-cream to-sage-50 border border-champagne-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-champagne-600 flex items-center gap-1"><Timer className="size-3.5" /> Mise en avant — compte à rebours actif</div>
                <div className="font-display text-xl mt-1">{p.name}</div>
                <div className="text-sm text-muted">{describe(p, name)}</div>
              </div>
              <Countdown to={p.endsAt} />
            </div>
          ))}
        </div>
      )}
      <Tabs className="mb-3" value={tab} onChange={setTab} tabs={[
        { id: 'live', label: 'En cours', count: d.promotions.filter((p) => state(p) === 'live').length },
        { id: 'future', label: 'Programmées', count: d.promotions.filter((p) => state(p) === 'future').length },
        { id: 'past', label: 'Terminées / inactives', count: d.promotions.filter((p) => state(p) === 'past').length },
        { id: 'all', label: 'Toutes' },
      ]} />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((p) => (
          <button key={p.id} onClick={() => setEdit(p)} className="card p-5 text-left cursor-pointer hover:shadow-lift transition">
            <div className="flex items-start justify-between gap-2">
              <Badge tone="gold">{PROMO_TYPES[p.type].label}</Badge>
              <Badge tone={state(p) === 'live' ? 'sage' : state(p) === 'future' ? 'sky' : 'neutral'} dot>{state(p) === 'live' ? 'En cours' : state(p) === 'future' ? 'Programmée' : 'Terminée'}</Badge>
            </div>
            <div className="font-medium mt-3">{p.name}</div>
            <div className="text-sm text-muted mt-0.5">{describe(p, name)}</div>
            {p.code && <div className="mt-3 inline-block font-mono text-xs px-2 py-1 rounded-md bg-cream border border-dashed border-sand">{p.code}</div>}
            <div className="flex justify-between text-xs text-muted mt-4 pt-3 border-t border-line">
              <span>{date(p.startsAt)} → {date(p.endsAt)}</span><span>{p.uses} utilisations</span>
            </div>
          </button>
        ))}
      </div>
      {edit && <PromoModal promo={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function PromoModal({ promo, onClose }: { promo: Promotion; onClose: () => void }) {
  const d = useData()
  const [p, setP] = useState(promo)
  const set = <K extends keyof Promotion>(k: K, v: Promotion[K]) => setP((x) => ({ ...x, [k]: v }))
  const needsCode = ['pourcentage', 'fixe', 'saisonniere'].includes(p.type)
  const save = () => {
    if (!p.name) return toast('Donnez un nom à la promotion')
    actions.savePromotion({ ...p, code: needsCode ? (p.code || p.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 10)).toUpperCase() : undefined })
    toast('Promotion enregistrée'); onClose()
  }
  return (
    <Modal open wide onClose={onClose} title={promo.name || 'Nouvelle promotion'} footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button><button className="btn-primary" onClick={save}>Enregistrer</button></>}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {(Object.keys(PROMO_TYPES) as PromoType[]).map((t) => (
          <button key={t} onClick={() => set('type', t)} className={cx('rounded-xl border p-2.5 text-left cursor-pointer transition', p.type === t ? 'border-sage-500 bg-sage-50' : 'border-line hover:border-sage-300')}>
            <div className="text-xs font-medium">{PROMO_TYPES[t].label}</div>
            <div className="text-[10px] text-muted mt-0.5 leading-tight">{PROMO_TYPES[t].hint}</div>
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Nom" className="sm:col-span-2"><input className="input" value={p.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex. Semaine du solaire" /></Field>
        {needsCode && <Field label="Code promo"><input className="input font-mono uppercase" value={p.code ?? ''} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="SOLAIRE15" /></Field>}
        {p.type !== 'bxgy' && <Field label={p.type === 'fixe' ? 'Montant (DH)' : 'Réduction (%)'}><input type="number" className="input" value={p.value} onChange={(e) => set('value', +e.target.value)} /></Field>}
        {p.type === 'categorie' && <Field label="Catégorie"><select className="input" value={p.target ?? ''} onChange={(e) => set('target', e.target.value)}><option value="">Choisir…</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>}
        {p.type === 'marque' && <Field label="Marque"><select className="input" value={p.target ?? ''} onChange={(e) => set('target', e.target.value)}><option value="">Choisir…</option>{[...new Set(d.products.map((x) => x.brand))].map((b) => <option key={b}>{b}</option>)}</select></Field>}
        {(p.type === 'flash' || p.type === 'bxgy') && <Field label="Produit"><select className="input" value={p.target ?? ''} onChange={(e) => set('target', e.target.value)}><option value="">Choisir…</option>{d.products.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>}
        {p.type === 'bxgy' && <>
          <Field label="Quantité achetée (X)"><input type="number" className="input" value={p.buyX ?? 2} onChange={(e) => set('buyX', +e.target.value)} /></Field>
          <Field label="Quantité offerte (Y)"><input type="number" className="input" value={p.getY ?? 1} onChange={(e) => set('getY', +e.target.value)} /></Field>
        </>}
        {(p.type === 'fixe' || p.type === 'saisonniere' || p.type === 'pourcentage') && <Field label="Minimum d’achat (DH)"><input type="number" className="input" value={p.minAmount ?? ''} onChange={(e) => set('minAmount', e.target.value ? +e.target.value : undefined)} /></Field>}
        <Field label="Début"><input type="datetime-local" className="input" value={p.startsAt.slice(0, 16)} onChange={(e) => set('startsAt', iso(new Date(e.target.value)))} /></Field>
        <Field label="Fin"><input type="datetime-local" className="input" value={p.endsAt.slice(0, 16)} onChange={(e) => set('endsAt', iso(new Date(e.target.value)))} /></Field>
      </div>
      <div className="flex flex-wrap gap-6 mt-5">
        <label className="flex items-center gap-2 text-sm"><Toggle on={p.active} onChange={(v) => set('active', v)} label="Active" /> Active</label>
        <label className="flex items-center gap-2 text-sm"><Toggle on={!!p.highlight} onChange={(v) => set('highlight', v)} label="Compte à rebours" /> Mettre en avant avec compte à rebours</label>
      </div>
    </Modal>
  )
}
