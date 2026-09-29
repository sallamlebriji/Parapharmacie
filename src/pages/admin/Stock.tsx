import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowDownToLine, ArrowLeftRight, CalendarClock, ClipboardCheck, Download, MinusCircle, PlusCircle, Search, SlidersHorizontal, Upload } from 'lucide-react'
import { actions, useCan, useData, useSession } from '../../lib/store'
import { CATEGORY_LABEL } from '../../data/plans'
import { dateTime, daysFromNow, daysUntil, download, iso, money, num, parseCSV, pct, sum, toCSV } from '../../lib/format'
import { expiringLots, marginRate, priceOf, stockIndex } from '../../lib/logic'
import { Badge, Card, Field, Modal, PageHeader, STOCK_STATE, Stat, StatusBadge, Tabs, cx, toast } from '../../components/ui'
import { ProductVisual } from '../../components/ProductVisual'
import type { MovementType } from '../../lib/types'

type Op = 'entree' | 'sortie' | 'ajustement' | 'transfert' | 'inventaire'
const OPS: { id: Op; label: string; icon: typeof PlusCircle }[] = [
  { id: 'entree', label: 'Entrée', icon: PlusCircle },
  { id: 'sortie', label: 'Sortie', icon: MinusCircle },
  { id: 'ajustement', label: 'Ajustement', icon: SlidersHorizontal },
  { id: 'transfert', label: 'Transfert', icon: ArrowLeftRight },
  { id: 'inventaire', label: 'Inventaire', icon: ClipboardCheck },
]
const MV_LABEL: Record<MovementType, { label: string; tone: string }> = {
  entree: { label: 'Entrée', tone: 'sage' }, sortie: { label: 'Sortie', tone: 'rose' }, ajustement: { label: 'Ajustement', tone: 'amber' },
  transfert: { label: 'Transfert', tone: 'sky' }, inventaire: { label: 'Inventaire', tone: 'gold' }, vente: { label: 'Vente', tone: 'neutral' }, retour: { label: 'Retour', tone: 'sky' },
}

export default function Stock() {
  const d = useData()
  const { scope } = useSession()
  const [params, setParams] = useSearchParams()
  const filter = params.get('f') ?? ''
  const [tab, setTab] = useState<'stock' | 'mouvements'>('stock')
  const [q, setQ] = useState('')
  const [op, setOp] = useState<{ op: Op; productId?: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const idx = useMemo(() => stockIndex(d, scope), [d, scope])
  const rows = d.products.map((p) => ({ p, ...idx(p) }))
  const stores = scope === 'all' ? d.stores : d.stores.filter((s) => s.id === scope)
  const perStore = (pid: string, sid: string) => sum(d.lots.filter((l) => l.productId === pid && l.storeId === sid), (l) => l.qty)
  const low = rows.filter((r) => r.state === 'faible')
  const out = rows.filter((r) => r.state === 'rupture')
  const exp = new Set(expiringLots(d, 60, scope).map((l) => l.productId))
  const list = rows.filter((r) => (!filter || r.state === filter) && (!q || `${r.p.name} ${r.p.brand} ${r.p.ref} ${r.p.barcode}`.toLowerCase().includes(q.toLowerCase())))
  const can = useCan()
  const suppliers = useMemo(() => new Map(d.suppliers.map((s) => [s.id, s.name])), [d.suppliers])
  // Nearest expiry among lots still in stock, per product.
  const nextExpiry = useMemo(() => {
    const m = new Map<string, string>()
    d.lots.forEach((l) => { if (l.qty > 0 && (scope === 'all' || l.storeId === scope)) { const c = m.get(l.productId); if (!c || l.expiresAt < c) m.set(l.productId, l.expiresAt) } })
    return m
  }, [d.lots, scope])
  const value = sum(d.lots.filter((l) => scope === 'all' || l.storeId === scope), (l) => l.qty * (d.products.find((p) => p.id === l.productId)?.purchasePrice ?? 0))

  const exportCSV = () => download('stock.csv', toCSV(d.lots.filter((l) => scope === 'all' || l.storeId === scope).map((l) => {
    const p = d.products.find((x) => x.id === l.productId)!
    return { reference: p.ref, produit: p.name, boutique: d.stores.find((s) => s.id === l.storeId)!.city, lot: l.number, quantite: l.qty, expiration: l.expiresAt.slice(0, 10) }
  })))
  const importCSV = async (f: File) => {
    const rows = parseCSV(await f.text())
    const n = await actions.importStock(rows.map((r) => ({ ref: r.reference ?? r.ref ?? r.ean, store: r.boutique ?? r.store ?? '', qty: Number(r.quantite ?? r.qty), lot: r.lot, expiry: r.expiration })))
    toast(`${n} ligne(s) importée(s)`)
  }
  const template = () => download('modele-import-stock.csv', 'reference;boutique;quantite;lot;expiration\n' + d.products.slice(0, 3).map((p) => `${p.ref};${d.stores[0].city};24;L${Math.floor(Math.random() * 90000)};${iso(daysFromNow(400)).slice(0, 10)}`).join('\n'))

  return (
    <div>
      <PageHeader title="Gestion du stock" subtitle="Stock par produit, lot et date d’expiration — synchronisé entre POS et e-commerce." actions={<>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCSV(e.target.files[0])} />
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> Importer</button>
        <button className="btn-secondary" onClick={exportCSV}><Download className="size-4" /> Exporter</button>
        <button className="btn-primary" onClick={() => setOp({ op: 'entree' })}><ArrowDownToLine className="size-4" /> Mouvement de stock</button>
      </>} />

      {(exp.size > 0 || low.length > 0 || out.length > 0) && (
        <div className="grid md:grid-cols-3 gap-3 mb-4" role="region" aria-label="Alertes de stock">
          {out.length > 0 && <button onClick={() => setParams({ f: 'rupture' })} className="card card-hover flex items-center gap-3 px-4 py-3 text-sm text-left cursor-pointer border-l-4 border-l-rose-ink"><span className="size-9 rounded-xl grid place-items-center bg-rose-soft text-rose-ink shrink-0"><MinusCircle className="size-4" aria-hidden /></span><span><b className="text-rose-ink num">{out.length} produits</b> en rupture<span className="block text-[11px] text-muted">À réapprovisionner en priorité</span></span></button>}
          {low.length > 0 && <button onClick={() => setParams({ f: 'faible' })} className="card card-hover flex items-center gap-3 px-4 py-3 text-sm text-left cursor-pointer border-l-4 border-l-amber-ink"><span className="size-9 rounded-xl grid place-items-center bg-amber-soft text-amber-ink shrink-0"><AlertTriangle className="size-4" aria-hidden /></span><span><b className="text-amber-ink num">{low.length} produits</b> sous le seuil minimum<span className="block text-[11px] text-muted">Dans au moins une boutique</span></span></button>}
          {exp.size > 0 && <Link to="/admin/lots" className="card card-hover flex items-center gap-3 px-4 py-3 text-sm border-l-4 border-l-champagne-400"><span className="size-9 rounded-xl grid place-items-center bg-champagne-100 text-champagne-600 shrink-0"><CalendarClock className="size-4" aria-hidden /></span><span><b className="num">{exp.size} produits</b> expirent sous 60 jours<span className="block text-[11px] text-muted">Voir les lots concernés</span></span></Link>}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Unités en stock" value={num(sum(rows, (r) => r.physical))} />
        <Stat label="Unités réservées (web)" value={num(sum(rows, (r) => r.reserved))} tone="sky" />
        <Stat label="Valeur du stock (coût)" value={money(value)} tone="gold" />
        <Stat label="Références actives" value={rows.filter((r) => r.physical > 0).length} hint={`sur ${rows.length}`} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'stock', label: 'Stock disponible' }, { id: 'mouvements', label: 'Mouvements', count: d.movements.length }]} />
        {tab === 'stock' && <Tabs value={filter} onChange={(v) => setParams(v ? { f: v } : {})} tabs={[{ id: '', label: 'Tous' }, { id: 'faible', label: 'Stock faible', count: low.length }, { id: 'rupture', label: 'Rupture', count: out.length }]} />}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-soft" />
          <input className="input pl-9" placeholder="Produit, référence, EAN" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {tab === 'stock' ? (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr>
                <th>Produit</th>
                {stores.length > 1 && stores.map((s) => <th key={s.id} className="text-right">{s.city}</th>)}
                <th className="text-right">Disponible</th><th className="text-right">Seuil</th>
                {can('prix_achat.view') && <th className="text-right">Achat</th>}
                <th className="text-right">Vente</th>
                {can('prix_achat.view') && <th className="text-right">Marge</th>}
                <th>Fournisseur</th><th>Expiration</th><th>État</th><th><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>
                {list.map((r) => {
                  const threshold = r.p.alertThreshold * stores.length
                  const fill = Math.min(1, r.available / Math.max(1, threshold * 3))
                  const expiry = nextExpiry.get(r.p.id)
                  const days = expiry ? daysUntil(expiry) : null
                  const pi = priceOf(d, r.p)
                  return (
                    <tr key={r.p.id} className={cx(r.state === 'rupture' && 'bg-rose-soft/35')}>
                      <td className={cx('border-l-[3px]', r.state === 'rupture' ? 'border-l-rose-ink' : r.state === 'faible' ? 'border-l-amber-ink' : 'border-l-transparent')}>
                        <div className="flex items-center gap-3 min-w-60">
                          <ProductVisual shape={r.p.shape} color={r.p.color} brand={r.p.brand} className="size-10 rounded-xl shrink-0" />
                          <div className="min-w-0">
                            <Link to={`/admin/produits/${r.p.id}`} className="block font-medium truncate max-w-64 hover:text-sage-600">{r.p.name}</Link>
                            <div className="text-[11px] text-muted num">{CATEGORY_LABEL[r.p.category]} · {r.p.ref}</div>
                          </div>
                        </div>
                      </td>
                      {stores.length > 1 && stores.map((s) => { const q = perStore(r.p.id, s.id); return <td key={s.id} className={cx('text-right num', q <= r.p.alertThreshold && 'text-amber-ink font-medium', q === 0 && 'text-rose-ink')}>{q}</td> })}
                      <td className="text-right">
                        <div className={cx('text-[15px] font-semibold num', r.state === 'rupture' ? 'text-rose-ink' : r.state === 'faible' ? 'text-amber-ink' : 'text-ink')}>{r.available}</div>
                        <div className="ml-auto mt-1 h-1 w-16 rounded-full bg-cream overflow-hidden" aria-hidden><div className={cx('h-full w-full origin-left rounded-full', r.state === 'rupture' ? 'bg-rose-ink' : r.state === 'faible' ? 'bg-amber-ink' : 'bg-sage-400')} style={{ transform: `scaleX(${fill})` }} /></div>
                        {r.reserved > 0 && <div className="text-[10px] text-muted mt-0.5">{r.reserved} réservé(s)</div>}
                      </td>
                      <td className="text-right num text-muted">{threshold}</td>
                      {can('prix_achat.view') && <td className="text-right num text-muted">{money(r.p.purchasePrice)}</td>}
                      <td className="text-right num whitespace-nowrap">{pi.oldPrice ? <span className="text-rose-ink font-medium">{money(pi.price)}</span> : money(r.p.price)}</td>
                      {can('prix_achat.view') && <td className="text-right num">{pct(marginRate(r.p) * 100, 0)}</td>}
                      <td className="text-xs text-muted max-w-36 truncate">{suppliers.get(r.p.supplierId) ?? '—'}</td>
                      <td className="whitespace-nowrap">{days === null ? <span className="text-soft text-xs">—</span> : days <= 90 ? <Badge tone={days < 0 || days <= 30 ? 'rose' : 'amber'}><CalendarClock className="size-3" aria-hidden />{days < 0 ? 'Expiré' : `J-${days}`}</Badge> : <span className="text-xs text-muted num">{new Date(expiry!).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span>}</td>
                      <td><StatusBadge map={STOCK_STATE} value={r.state} /></td>
                      <td className="text-right whitespace-nowrap">
                        <button className="btn-ghost btn-sm" onClick={() => setOp({ op: 'entree', productId: r.p.id })}>Entrée</button>
                        <button className="btn-ghost btn-sm" onClick={() => setOp({ op: 'ajustement', productId: r.p.id })}>Ajuster</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 text-xs text-muted flex justify-between">
            <span>Réservé = commandes web reçues ou en préparation, non encore expédiées.</span>
            <button className="text-sage-600 hover:underline cursor-pointer" onClick={template}>Télécharger le modèle d’import</button>
          </div>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Date</th><th>Type</th><th>Produit</th><th>Boutique</th><th>Lot</th><th className="text-right">Qté</th><th>Motif</th><th>Par</th></tr></thead>
              <tbody>
                {[...d.movements].filter((m) => scope === 'all' || m.storeId === scope).filter((m) => !q || d.products.find((p) => p.id === m.productId)?.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 120).map((m) => {
                  const p = d.products.find((x) => x.id === m.productId)
                  return (
                    <tr key={m.id}>
                      <td className="text-muted whitespace-nowrap">{dateTime(m.date)}</td>
                      <td><StatusBadge map={MV_LABEL} value={m.type} /></td>
                      <td className="max-w-64 truncate">{p?.name}</td>
                      <td className="whitespace-nowrap">{d.stores.find((s) => s.id === m.storeId)?.city}{m.toStoreId && ` → ${d.stores.find((s) => s.id === m.toStoreId)?.city}`}</td>
                      <td className="font-mono text-xs">{d.lots.find((l) => l.id === m.lotId)?.number ?? '—'}</td>
                      <td className={cx('text-right tabular-nums font-medium', m.qty > 0 ? 'text-sage-600' : 'text-rose-ink')}>{m.qty > 0 ? '+' : ''}{m.qty}</td>
                      <td className="text-muted max-w-56 truncate">{m.note}</td>
                      <td className="text-muted whitespace-nowrap">{m.user}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {op && <MovementModal init={op} onClose={() => setOp(null)} />}
    </div>
  )
}

function MovementModal({ init, onClose }: { init: { op: Op; productId?: string }; onClose: () => void }) {
  const d = useData()
  const { scope } = useSession()
  const [op, setOp] = useState<Op>(init.op)
  const [productId, setProductId] = useState(init.productId ?? d.products[0].id)
  const [storeId, setStoreId] = useState(scope !== 'all' ? scope : d.stores[0].id)
  const [toStore, setToStore] = useState(d.stores.find((s) => s.id !== storeId)?.id ?? '')
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [lot, setLot] = useState(`L${Math.floor(Math.random() * 90000 + 10000)}`)
  const [expiry, setExpiry] = useState(iso(daysFromNow(540)).slice(0, 10))
  const current = sum(d.lots.filter((l) => l.productId === productId && l.storeId === storeId), (l) => l.qty)
  const p = d.products.find((x) => x.id === productId)!

  const submit = () => {
    if (op === 'entree') actions.addLot({ productId, storeId, number: lot, qty, expiresAt: iso(new Date(expiry)), supplierId: p.supplierId, note: note || undefined })
    else if (op === 'sortie') actions.adjustStock(productId, storeId, -Math.min(qty, current), note || 'Sortie manuelle', 'sortie')
    else if (op === 'ajustement') actions.adjustStock(productId, storeId, qty, note || 'Ajustement manuel')
    else if (op === 'transfert') actions.transferStock(productId, storeId, toStore, Math.min(qty, current))
    else actions.inventoryCount(productId, storeId, qty)
    toast('Mouvement enregistré')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="Mouvement de stock" footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button><button className="btn-primary" onClick={submit}>Valider</button></>}>
      <div className="grid grid-cols-5 gap-1.5 mb-5">
        {OPS.filter((o) => o.id !== 'transfert' || d.stores.length > 1).map((o) => (
          <button key={o.id} onClick={() => { setOp(o.id); if (o.id === 'inventaire') setQty(current) }} className={cx('flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs cursor-pointer transition', op === o.id ? 'border-sage-500 bg-sage-50 text-sage-700' : 'border-line text-muted hover:border-sage-300')}>
            <o.icon className="size-4" />{o.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Produit" className="col-span-2">
          <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>{d.products.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.brand}</option>)}</select>
        </Field>
        <Field label={op === 'transfert' ? 'Depuis' : 'Boutique'}>
          <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>{d.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </Field>
        {op === 'transfert' ? (
          <Field label="Vers"><select className="input" value={toStore} onChange={(e) => setToStore(e.target.value)}>{d.stores.filter((s) => s.id !== storeId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        ) : <div className="flex items-end pb-2 text-sm text-muted">Stock actuel : <b className="ml-1 text-ink">{current}</b></div>}
        <Field label={op === 'inventaire' ? 'Quantité comptée' : op === 'ajustement' ? 'Écart (+/−)' : 'Quantité'} hint={op === 'ajustement' ? 'Ex. −2 pour une casse' : op === 'inventaire' ? `Écart : ${qty - current >= 0 ? '+' : ''}${qty - current}` : undefined}>
          <input type="number" className="input" value={qty} onChange={(e) => setQty(+e.target.value)} />
        </Field>
        {op === 'entree' && <>
          <Field label="N° de lot"><input className="input font-mono" value={lot} onChange={(e) => setLot(e.target.value)} /></Field>
          <Field label="Date d’expiration"><input type="date" className="input" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
        </>}
        {op !== 'inventaire' && op !== 'transfert' && <Field label="Motif" className="col-span-2"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Casse, échantillon, réception hors commande…" /></Field>}
      </div>
      {(op === 'sortie' || op === 'transfert') && <p className="text-xs text-muted mt-3">Les unités sont prélevées selon la règle FEFO (premier expiré, premier sorti).</p>}
    </Modal>
  )
}
