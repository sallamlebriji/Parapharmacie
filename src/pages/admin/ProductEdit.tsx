import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, ImagePlus, Plus, Save } from 'lucide-react'
import { actions, useCan, useData } from '../../lib/store'
import { CATEGORIES, NEEDS, SKIN_TYPES, BRANDS } from '../../data/catalog'
import { date, daysFromNow, daysUntil, iso, money, pct, sum, uid } from '../../lib/format'
import { ordersInRange, productSales, stockIndex } from '../../lib/logic'
import { Badge, Card, Field, Modal, PageHeader, STOCK_STATE, StatusBadge, Toggle, cx, toast } from '../../components/ui'
import { ProductVisual } from '../../components/ProductVisual'
import type { Product, Shape } from '../../lib/types'

const SHAPES: { id: Shape; label: string }[] = [
  { id: 'bottle', label: 'Flacon' }, { id: 'pump', label: 'Pompe' }, { id: 'dropper', label: 'Compte-gouttes' }, { id: 'tube', label: 'Tube' },
  { id: 'jar', label: 'Pot' }, { id: 'spray', label: 'Spray' }, { id: 'box', label: 'Boîte' }, { id: 'stick', label: 'Stick' },
]

const blank = (supplierId: string): Product => ({
  id: uid('p'), name: '', brand: BRANDS[0].name, ref: '', barcode: '', category: 'visage', subcategory: 'Nettoyants', needs: [], skinTypes: [],
  description: '', composition: '', usage: '', warnings: '', purchasePrice: 0, price: 0, alertThreshold: 8, supplierId, shape: 'bottle',
  color: '#e3ebe4', volume: '', rating: 0, reviewsCount: 0, isNew: true, createdAt: iso(new Date()), active: true,
})

export default function ProductEditPage() {
  const { id } = useParams()
  return <ProductEdit key={id} />
}

function ProductEdit() {
  const { id } = useParams()
  const nav = useNavigate()
  const d = useData()
  const can = useCan()
  const existing = d.products.find((p) => p.id === id)
  const [p, setP] = useState<Product>(() => existing ?? blank(d.suppliers[0].id))
  const [lotOpen, setLotOpen] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }))
  const editable = can('produits.edit')
  const cat = CATEGORIES.find((c) => c.id === p.category)!
  const margin = p.price - p.purchasePrice
  const promoMargin = p.promoPrice ? p.promoPrice - p.purchasePrice : null
  const lots = d.lots.filter((l) => l.productId === p.id).sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
  const s = useMemo(() => stockIndex(d, 'all')(p), [d, p])
  const sales30 = useMemo(() => productSales(ordersInRange(d, 'all', 29)).get(p.id), [d, p.id])

  const save = async () => {
    if (!p.name || !p.price) return toast('Nom et prix de vente requis', 'error')
    const id = await actions.saveProduct(p)
    toast(existing ? 'Produit mis à jour' : 'Produit créé')
    if (!existing) nav(`/admin/produits/${id}`, { replace: true })
  }

  return (
    <div>
      <button onClick={() => nav('/admin/produits')} className="btn-ghost btn-sm mb-3 -ml-2"><ArrowLeft className="size-4" /> Catalogue</button>
      <PageHeader
        title={existing ? p.name : 'Nouveau produit'}
        subtitle={existing ? `${p.brand} · ${p.ref}` : 'Renseignez les informations de la fiche produit.'}
        actions={<>
          {existing && <Link to={`/boutique/produit/${p.id}`} target="_blank" className="btn-secondary"><ExternalLink className="size-4" /> Voir en boutique</Link>}
          {editable && <button className="btn-primary" onClick={save}><Save className="size-4" /> Enregistrer</button>}
        </>}
      />
      <fieldset disabled={!editable} className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Informations générales">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nom du produit" className="sm:col-span-2"><input className="input" value={p.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Marque">
                <select className="input" value={p.brand} onChange={(e) => set('brand', e.target.value)}>{BRANDS.map((b) => <option key={b.name}>{b.name}</option>)}</select>
              </Field>
              <Field label="Contenance"><input className="input" value={p.volume} onChange={(e) => set('volume', e.target.value)} placeholder="50 ml" /></Field>
              <Field label="Référence"><input className="input" value={p.ref} onChange={(e) => set('ref', e.target.value)} /></Field>
              <Field label="Code-barres (EAN)"><input className="input font-mono" value={p.barcode} onChange={(e) => set('barcode', e.target.value)} /></Field>
              <Field label="Catégorie">
                <select className="input" value={p.category} onChange={(e) => { const c = CATEGORIES.find((x) => x.id === e.target.value)!; setP((x) => ({ ...x, category: c.id, subcategory: c.subs[0] })) }}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Sous-catégorie">
                <select className="input" value={p.subcategory} onChange={(e) => set('subcategory', e.target.value)}>{cat.subs.map((s) => <option key={s}>{s}</option>)}</select>
              </Field>
              <Field label="Besoins (recherche & recommandations)" className="sm:col-span-2">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(NEEDS).map(([k, v]) => (
                    <button type="button" key={k} onClick={() => set('needs', p.needs.includes(k) ? p.needs.filter((n) => n !== k) : [...p.needs, k])} className={cx('chip border cursor-pointer', p.needs.includes(k) ? 'bg-accent text-on-accent border-sage-600' : 'bg-surface border-line text-muted hover:border-sage-300')}>{v}</button>
                  ))}
                </div>
              </Field>
              <Field label="Types de peau" className="sm:col-span-2">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(SKIN_TYPES).map(([k, v]) => (
                    <button type="button" key={k} onClick={() => set('skinTypes', p.skinTypes.includes(k) ? p.skinTypes.filter((n) => n !== k) : [...p.skinTypes, k])} className={cx('chip border cursor-pointer', p.skinTypes.includes(k) ? 'bg-accent text-on-accent border-sage-600' : 'bg-surface border-line text-muted hover:border-sage-300')}>{v}</button>
                  ))}
                </div>
              </Field>
            </div>
          </Card>
          <Card title="Contenu de la fiche">
            <div className="space-y-4">
              <Field label="Description"><textarea rows={3} className="input" value={p.description} onChange={(e) => set('description', e.target.value)} /></Field>
              <Field label="Composition (INCI)"><textarea rows={2} className="input" value={p.composition} onChange={(e) => set('composition', e.target.value)} /></Field>
              <Field label="Mode d’utilisation"><textarea rows={2} className="input" value={p.usage} onChange={(e) => set('usage', e.target.value)} /></Field>
              <Field label="Informations importantes / précautions"><textarea rows={2} className="input" value={p.warnings} onChange={(e) => set('warnings', e.target.value)} /></Field>
            </div>
          </Card>
          <Card title="Lots en stock" action={existing && can('stock.manage') && <button type="button" className="btn-secondary btn-sm" onClick={() => setLotOpen(true)}><Plus className="size-3.5" /> Réceptionner un lot</button>} padded={false}>
            {lots.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">Aucun lot enregistré.</p> : (
              <table className="table-base">
                <thead><tr><th>N° de lot</th><th>Boutique</th><th>Réception</th><th>Expiration</th><th className="text-right">Quantité</th></tr></thead>
                <tbody>
                  {lots.map((l) => {
                    const days = daysUntil(l.expiresAt)
                    return (
                      <tr key={l.id}>
                        <td className="font-mono text-xs">{l.number}</td>
                        <td>{d.stores.find((s) => s.id === l.storeId)?.city}</td>
                        <td className="text-muted">{date(l.receivedAt)}</td>
                        <td>{date(l.expiresAt)} {days <= 90 && <Badge tone={days <= 30 ? 'rose' : 'amber'}>{days} j</Badge>}</td>
                        <td className="text-right tabular-nums font-medium">{l.qty}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Visuels">
            <div className="rounded-2xl overflow-hidden border border-line">
              <ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="w-full aspect-square" />
            </div>
            <div className="grid grid-cols-4 gap-1.5 mt-3">
              {SHAPES.map((sh) => (
                <button type="button" key={sh.id} onClick={() => set('shape', sh.id)} className={cx('rounded-lg border p-1 cursor-pointer', p.shape === sh.id ? 'border-sage-500 ring-2 ring-sage-100' : 'border-line')} title={sh.label}>
                  <ProductVisual shape={sh.id} color={p.color} brand="" bg={false} className="w-full aspect-square" />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input type="color" value={p.color} onChange={(e) => set('color', e.target.value)} className="size-9 rounded-lg border border-line cursor-pointer" aria-label="Couleur du packaging" />
              <span className="text-xs text-muted">Couleur du packaging</span>
            </div>
            <label className="mt-3 flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-sage-300 bg-sage-50/50 p-4 text-center cursor-pointer hover:bg-sage-50">
              <ImagePlus className="size-5 text-sage-500" />
              <span className="text-xs text-muted">Ajouter des photos produit (JPG, PNG, WebP)</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setPhotos([...photos, ...[...(e.target.files ?? [])].map((f) => URL.createObjectURL(f))])} />
            </label>
            {photos.length > 0 && <div className="grid grid-cols-4 gap-1.5 mt-2">{photos.map((src) => <img key={src} src={src} alt="" className="aspect-square object-cover rounded-lg" />)}</div>}
          </Card>
          <Card title="Tarification">
            <div className="grid grid-cols-2 gap-3">
              {can('prix_achat.view') && (
                <Field label="Prix d’achat HT" className="col-span-2" hint={!can('prix_achat.edit') ? 'Lecture seule pour votre rôle' : undefined}>
                  <input type="number" className="input" value={p.purchasePrice} disabled={!can('prix_achat.edit')} onChange={(e) => set('purchasePrice', +e.target.value)} />
                </Field>
              )}
              <Field label="Prix de vente TTC"><input type="number" className="input" value={p.price} onChange={(e) => set('price', +e.target.value)} /></Field>
              <Field label="Prix promotionnel"><input type="number" className="input" value={p.promoPrice ?? ''} placeholder="—" onChange={(e) => set('promoPrice', e.target.value ? +e.target.value : undefined)} /></Field>
            </div>
            {can('prix_achat.view') && p.price > 0 && (
              <div className="mt-4 rounded-xl bg-ivory border border-line p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted">Marge</span><span className="font-medium tabular-nums">{money(margin)} · {pct((margin / p.price) * 100)}</span></div>
                {promoMargin !== null && <div className="flex justify-between"><span className="text-muted">Marge en promo</span><span className={cx('font-medium tabular-nums', promoMargin < 0 && 'text-rose-ink')}>{money(promoMargin)} · {pct((promoMargin / p.promoPrice!) * 100)}</span></div>}
                <div className="flex justify-between"><span className="text-muted">Coefficient</span><span className="tabular-nums">× {(p.price / (p.purchasePrice || 1)).toFixed(2).replace('.', ',')}</span></div>
              </div>
            )}
          </Card>
          <Card title="Stock & approvisionnement">
            <div className="space-y-3">
              <Field label="Seuil d’alerte (par boutique)"><input type="number" className="input" value={p.alertThreshold} onChange={(e) => set('alertThreshold', +e.target.value)} /></Field>
              <Field label="Fournisseur">
                <select className="input" value={p.supplierId} onChange={(e) => set('supplierId', e.target.value)}>{d.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              </Field>
              {existing && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-ivory border border-line p-2"><div className="text-lg font-semibold tabular-nums">{s.physical}</div><div className="text-[10px] text-muted">Physique</div></div>
                  <div className="rounded-xl bg-ivory border border-line p-2"><div className="text-lg font-semibold tabular-nums">{s.reserved}</div><div className="text-[10px] text-muted">Réservé</div></div>
                  <div className="rounded-xl bg-ivory border border-line p-2"><div className="text-lg font-semibold tabular-nums">{s.available}</div><div className="text-[10px] text-muted">Disponible</div></div>
                </div>
              )}
              {existing && <div className="flex items-center justify-between text-sm"><span className="text-muted">État</span><StatusBadge map={STOCK_STATE} value={s.state} /></div>}
              {sales30 && <div className="flex items-center justify-between text-sm"><span className="text-muted">Ventes 30 jours</span><span className="font-medium">{sales30.qty} u. · {money(sales30.revenue)}</span></div>}
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div><div className="text-sm font-medium">Visible en boutique en ligne</div><div className="text-xs text-muted">Désactiver pour archiver le produit</div></div>
              <Toggle on={p.active} onChange={(v) => set('active', v)} label="Actif" />
            </div>
          </Card>
        </div>
      </fieldset>
      <LotModal open={lotOpen} onClose={() => setLotOpen(false)} product={p} />
    </div>
  )
}

export function LotModal({ open, onClose, product }: { open: boolean; onClose: () => void; product: Product }) {
  const d = useData()
  const [f, setF] = useState({ number: `L${Math.floor(Math.random() * 90000 + 10000)}`, qty: 24, storeId: d.stores[0].id, expiresAt: iso(daysFromNow(540)).slice(0, 10) })
  const submit = async () => {
    await actions.addLot({ productId: product.id, storeId: f.storeId, number: f.number, qty: f.qty, expiresAt: iso(new Date(f.expiresAt)), supplierId: product.supplierId })
    toast(`Lot ${f.number} ajouté (+${f.qty})`)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Réceptionner un lot" footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button><button className="btn-primary" onClick={submit}>Ajouter au stock</button></>}>
      <p className="text-sm text-muted mb-4">{product.name}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Numéro de lot"><input className="input font-mono" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></Field>
        <Field label="Quantité"><input type="number" className="input" value={f.qty} onChange={(e) => setF({ ...f, qty: +e.target.value })} /></Field>
        <Field label="Boutique"><select className="input" value={f.storeId} onChange={(e) => setF({ ...f, storeId: e.target.value })}>{d.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Date d’expiration"><input type="date" className="input" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></Field>
      </div>
      <p className="text-xs text-muted mt-3">Total en stock après réception : {sum(d.lots.filter((l) => l.productId === product.id), (l) => l.qty) + f.qty} unités.</p>
    </Modal>
  )
}
