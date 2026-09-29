import { useMemo, useRef, useState } from 'react'
import { Banknote, CreditCard, Minus, Plus, Printer, RotateCcw, ScanBarcode, Search, Trash2, UserRound, Wallet, X } from 'lucide-react'
import { actions, useCan, useData, useSession, useTenant } from '../../lib/store'
import { CATEGORIES } from '../../data/catalog'
import { dateTime, money, sum } from '../../lib/format'
import { customerStats, priceOf } from '../../lib/logic'
import { Badge, Card, Empty, Field, Modal, PageHeader, Tabs, cx, toast } from '../../components/ui'
import { ProductVisual } from '../../components/ProductVisual'
import type { Order } from '../../lib/types'

type Line = { productId: string; qty: number; unitPrice: number }

export default function POS() {
  const d = useData()
  const { scope } = useSession()
  const [storeId, setStoreId] = useState(scope !== 'all' ? scope : d.stores[0].id)
  const [tab, setTab] = useState<'vente' | 'retour' | 'caisse'>('vente')
  return (
    <div>
      <PageHeader title="Caisse" subtitle="Point de vente synchronisé en temps réel avec le stock et la boutique en ligne." actions={<>
        <select className="input w-auto" value={storeId} onChange={(e) => setStoreId(e.target.value)}>{d.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'vente', label: 'Vente' }, { id: 'retour', label: 'Retour / échange' }, { id: 'caisse', label: 'Gestion de caisse' }]} />
      </>} />
      {tab === 'vente' && <Sale storeId={storeId} />}
      {tab === 'retour' && <Returns storeId={storeId} />}
      {tab === 'caisse' && <Register storeId={storeId} />}
    </div>
  )
}

function Sale({ storeId }: { storeId: string }) {
  const d = useData()
  const t = useTenant()
  const can = useCan()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [discount, setDiscount] = useState({ type: '%' as '%' | 'DH', value: 0 })
  const [customerId, setCustomerId] = useState<string>('')
  const [custQ, setCustQ] = useState('')
  const [usePoints, setUsePoints] = useState(false)
  const [pay, setPay] = useState<null | 'carte' | 'especes'>(null)
  const [given, setGiven] = useState(0)
  const [receipt, setReceipt] = useState<Order | null>(null)
  const [busy, setBusy] = useState(false)
  const scanRef = useRef<HTMLInputElement>(null)

  const stockHere = useMemo(() => {
    const m = new Map<string, number>()
    d.lots.forEach((l) => l.storeId === storeId && m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty))
    return m
  }, [d.lots, storeId])
  const products = d.products.filter((p) => p.active && (!cat || p.category === cat) && (!q || `${p.name} ${p.brand} ${p.barcode} ${p.ref}`.toLowerCase().includes(q.toLowerCase())))
  const customer = d.customers.find((c) => c.id === customerId)
  const custMatches = custQ.length >= 2 ? d.customers.filter((c) => `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(custQ.toLowerCase())).slice(0, 5) : []

  const add = (pid: string) => {
    const p = d.products.find((x) => x.id === pid)!
    const inCart = lines.find((l) => l.productId === pid)?.qty ?? 0
    if (inCart + 1 > (stockHere.get(pid) ?? 0)) return toast(`Stock insuffisant en boutique pour ${p.name}`)
    setLines((ls) => ls.some((l) => l.productId === pid) ? ls.map((l) => (l.productId === pid ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { productId: pid, qty: 1, unitPrice: priceOf(d, p).price }])
  }
  const scan = (code: string) => {
    const p = d.products.find((x) => x.barcode === code.trim() || x.ref.toLowerCase() === code.trim().toLowerCase())
    if (p) { add(p.id); setQ('') } else toast('Code-barres inconnu')
  }
  const subtotal = sum(lines, (l) => l.qty * l.unitPrice)
  const disc = Math.min(subtotal, discount.type === '%' ? Math.round((subtotal * discount.value) / 100) : discount.value)
  const maxPts = customer ? Math.min(customer.points, Math.floor(((subtotal - disc) * 0.5) / t.settings.pointValue)) : 0
  const ptsDisc = usePoints ? Math.round(maxPts * t.settings.pointValue) : 0
  const total = Math.max(0, subtotal - disc - ptsDisc)

  const validate = async () => {
    setBusy(true)
    try {
      // Prices are re-applied by the server from the catalogue; the terminal only sends quantities.
      const o = await actions.posSale({ storeId, lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })), discount: disc, method: pay!, customerId: customerId || undefined, pointsUsed: usePoints ? maxPts : 0 })
      setReceipt(o)
      setLines([]); setDiscount({ type: '%', value: 0 }); setCustomerId(''); setUsePoints(false); setPay(null); setGiven(0)
    } catch { /* error toast shown by the store */ } finally { setBusy(false) }
  }

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 space-y-3">
        <div className="card p-3 flex gap-2">
          <div className="relative flex-1">
            <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-sage-500" />
            <input ref={scanRef} autoFocus className="input pl-9" placeholder="Scanner un code-barres ou rechercher un produit…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (products.length === 1 ? (add(products[0].id), setQ('')) : scan(q))} />
          </div>
          <button className="btn-secondary" title="Simuler un scan" onClick={() => { const p = d.products[Math.floor(Math.random() * d.products.length)]; scan(p.barcode); scanRef.current?.focus() }}><ScanBarcode className="size-4" /> Scan démo</button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
          <button onClick={() => setCat('')} className={cx('chip h-8 px-3 border cursor-pointer', !cat ? 'bg-accent text-on-accent border-sage-600' : 'bg-surface border-line text-muted')}>Tout</button>
          {CATEGORIES.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={cx('chip h-8 px-3 border cursor-pointer', cat === c.id ? 'bg-accent text-on-accent border-sage-600' : 'bg-surface border-line text-muted')}>{c.label}</button>)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-thin pr-1">
          {products.map((p) => {
            const st = stockHere.get(p.id) ?? 0
            const pi = priceOf(d, p)
            return (
              <button key={p.id} onClick={() => add(p.id)} disabled={st === 0} className="card p-2.5 text-left cursor-pointer transition hover:shadow-lift hover:border-sage-300 active:scale-[.98] disabled:opacity-50">
                <ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="w-full aspect-[4/3] rounded-lg" />
                <div className="text-xs font-medium mt-2 line-clamp-2 leading-snug min-h-8">{p.name}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className={cx('text-sm font-semibold tabular-nums', pi.oldPrice && 'text-rose-ink')}>{money(pi.price)}</span>
                  <span className={cx('text-[10px]', st <= p.alertThreshold ? 'text-amber-ink' : 'text-soft')}>{st} en stock</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div className="lg:col-span-2">
        <div className="card flex flex-col lg:sticky lg:top-20 max-h-[calc(100vh-120px)]">
          <div className="p-4 border-b border-line">
            {customer ? (
              <div className="flex items-center gap-2">
                <UserRound className="size-4 text-sage-500" />
                <div className="flex-1 text-sm"><b>{customer.firstName} {customer.lastName}</b> <span className="text-muted">· {customer.points} pts · {customerStats(d, customer).tier.id}</span></div>
                <button className="btn-ghost h-7 w-7 p-0" onClick={() => { setCustomerId(''); setUsePoints(false) }} aria-label="Retirer le client"><X className="size-4" /></button>
              </div>
            ) : (
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-soft" />
                <input className="input pl-9" placeholder="Client fidélité (nom ou téléphone)" value={custQ} onChange={(e) => setCustQ(e.target.value)} />
                {custMatches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full card shadow-lift p-1">
                    {custMatches.map((c) => <button key={c.id} onClick={() => { setCustomerId(c.id); setCustQ('') }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-cream text-sm cursor-pointer">{c.firstName} {c.lastName} <span className="text-muted">· {c.phone}</span></button>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-line min-h-40">
            {lines.length === 0 ? <Empty icon={<ScanBarcode className="size-5" />} title="Panier vide" text="Scannez ou touchez un produit pour l’ajouter." /> : lines.map((l, i) => {
              const p = d.products.find((x) => x.id === l.productId)!
              return (
                <div key={l.productId} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="flex-1 min-w-0"><div className="text-[13px] truncate">{p.name}</div><div className="text-[11px] text-muted tabular-nums">{money(l.unitPrice, true)}</div></div>
                  <div className="flex items-center gap-1">
                    <button className="btn-secondary h-7 w-7 p-0" onClick={() => setLines(lines.map((x, j) => (j === i ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0))} aria-label="Moins"><Minus className="size-3" /></button>
                    <span className="w-6 text-center text-sm tabular-nums">{l.qty}</span>
                    <button className="btn-secondary h-7 w-7 p-0" onClick={() => add(l.productId)} aria-label="Plus"><Plus className="size-3" /></button>
                  </div>
                  <div className="w-20 text-right text-sm font-medium tabular-nums">{money(l.qty * l.unitPrice)}</div>
                  <button className="btn-ghost h-7 w-7 p-0" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Supprimer"><Trash2 className="size-3.5" /></button>
                </div>
              )
            })}
          </div>
          <div className="p-4 border-t border-line space-y-2 bg-ivory rounded-b-2xl">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted flex-1">Remise {!can('pos.remise') && <span className="text-[11px]">(non autorisée)</span>}</span>
              <input type="number" min={0} disabled={!can('pos.remise')} className="input h-8 w-20" value={discount.value} onChange={(e) => setDiscount({ ...discount, value: Math.max(0, +e.target.value) })} aria-label="Remise" />
              <Tabs value={discount.type} onChange={(v) => setDiscount({ ...discount, type: v })} tabs={[{ id: '%' as const, label: '%' }, { id: 'DH' as const, label: 'DH' }]} />
            </div>
            {customer && maxPts > 0 && (
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} /> Utiliser {maxPts} points (−{money(maxPts * t.settings.pointValue)})</label>
            )}
            <div className="flex justify-between text-sm text-muted"><span>Sous-total</span><span className="tabular-nums">{money(subtotal, true)}</span></div>
            {disc + ptsDisc > 0 && <div className="flex justify-between text-sm text-sage-600"><span>Réductions</span><span className="tabular-nums">−{money(disc + ptsDisc, true)}</span></div>}
            <div className="flex justify-between text-xl font-semibold pt-1"><span>Total</span><span className="tabular-nums">{money(total, true)}</span></div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button disabled={!lines.length} onClick={() => { setPay('carte') }} className="btn-primary h-12"><CreditCard className="size-4" /> Carte</button>
              <button disabled={!lines.length} onClick={() => { setPay('especes'); setGiven(Math.ceil(total / 50) * 50) }} className="btn-gold h-12"><Banknote className="size-4" /> Espèces</button>
            </div>
          </div>
        </div>
      </div>
      <Modal open={!!pay} onClose={() => setPay(null)} title={pay === 'carte' ? 'Paiement par carte' : 'Paiement en espèces'} footer={<><button className="btn-secondary" onClick={() => setPay(null)}>Annuler</button><button className="btn-primary" disabled={busy || (pay === 'especes' && given < total)} onClick={validate}>Encaisser {money(total, true)}</button></>}>
        {pay === 'carte' ? (
          <div className="text-center py-6"><CreditCard className="size-10 mx-auto text-sage-500" /><p className="mt-3 text-sm text-muted">Présentez la carte sur le terminal de paiement.<br />Montant : <b className="text-ink">{money(total, true)}</b></p></div>
        ) : (
          <div className="space-y-3">
            <Field label="Montant remis"><input type="number" autoFocus className="input text-lg" value={given} onChange={(e) => setGiven(+e.target.value)} /></Field>
            <div className="flex gap-2">{[total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100, Math.ceil(total / 200) * 200].filter((v, i, a) => a.indexOf(v) === i).map((v) => <button key={v} className="btn-secondary btn-sm" onClick={() => setGiven(v)}>{money(v)}</button>)}</div>
            <div className="flex justify-between text-lg font-semibold rounded-xl bg-sage-50 px-4 py-3"><span>Rendu monnaie</span><span className="tabular-nums">{money(Math.max(0, given - total), true)}</span></div>
          </div>
        )}
      </Modal>
      {receipt && <Receipt order={receipt} onClose={() => setReceipt(null)} />}
    </div>
  )
}

function Receipt({ order, onClose }: { order: Order; onClose: () => void }) {
  const d = useData()
  const t = useTenant()
  const store = d.stores.find((s) => s.id === order.storeId)!
  const c = d.customers.find((x) => x.id === order.customerId)
  return (
    <Modal open onClose={onClose} title="Vente enregistrée ✓" footer={<><button className="btn-secondary" onClick={() => window.print()}><Printer className="size-4" /> Imprimer le reçu</button><button className="btn-primary" onClick={onClose}>Nouvelle vente</button></>}>
      <div className="mx-auto max-w-xs bg-surface border border-dashed border-sand rounded-lg p-5 font-mono text-[12px] leading-relaxed">
        <div className="text-center">
          <div className="font-display text-base font-sans">{t.name}</div>
          <div>{store.address}</div><div>{store.city} · {store.phone}</div>
          <div className="mt-1">{dateTime(order.createdAt)} · {order.number}</div>
        </div>
        <div className="border-t border-dashed border-sand my-2" />
        {order.items.map((i) => { const p = d.products.find((x) => x.id === i.productId)!; return <div key={i.productId}><div>{p.name}</div><div className="flex justify-between"><span>{i.qty} × {i.unitPrice.toFixed(2)}</span><span>{(i.qty * i.unitPrice).toFixed(2)}</span></div></div> })}
        <div className="border-t border-dashed border-sand my-2" />
        {order.discount > 0 && <div className="flex justify-between"><span>Remise</span><span>−{order.discount.toFixed(2)}</span></div>}
        <div className="flex justify-between font-bold text-[13px]"><span>TOTAL TTC</span><span>{order.total.toFixed(2)} DH</span></div>
        <div className="flex justify-between"><span>Dont TVA {t.settings.vatRate} %</span><span>{(order.total - order.total / (1 + t.settings.vatRate / 100)).toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Paiement</span><span>{order.payment.method === 'carte' ? 'Carte' : 'Espèces'}</span></div>
        {c && <div className="mt-2 text-center">Fidélité : +{Math.floor(order.total * t.settings.pointsPerDh)} pts · solde {c.points} pts</div>}
        <div className="border-t border-dashed border-sand my-2" />
        <div className="text-center">Merci de votre visite !<br />Échange sous 14 jours avec ce ticket.</div>
      </div>
    </Modal>
  )
}

function Returns({ storeId }: { storeId: string }) {
  const d = useData()
  const [q, setQ] = useState('')
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [mode, setMode] = useState<'remboursement' | 'avoir'>('remboursement')
  const order = d.orders.find((o) => o.number.toLowerCase() === q.trim().toLowerCase() && !o.number.startsWith('RET'))
  const recent = d.orders.filter((o) => o.storeId === storeId && o.channel === 'pos' && !o.number.startsWith('RET')).slice(0, 6)
  const refund = order ? sum(order.items, (i) => (qtys[i.productId] ?? 0) * i.unitPrice) : 0
  const submit = async () => {
    await actions.posReturn(order!.id, Object.entries(qtys).map(([productId, qty]) => ({ productId, qty })), mode)
    toast(mode === 'remboursement' ? `Remboursement de ${money(refund)} effectué` : `Avoir de ${money(refund)} émis — utilisable pour un échange`)
    setQtys({}); setQ('')
  }
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title="Retrouver la vente">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-soft" />
          <input className="input pl-9" placeholder="N° de ticket (ex. POS-12345)" value={q} onChange={(e) => { setQ(e.target.value); setQtys({}) }} />
        </div>
        <div className="text-xs text-muted mt-4 mb-2">Ventes récentes de la boutique</div>
        <ul className="space-y-1">{recent.map((o) => <li key={o.id}><button className="w-full flex justify-between text-sm px-3 py-2 rounded-lg hover:bg-cream cursor-pointer" onClick={() => { setQ(o.number); setQtys({}) }}><span>{o.number}</span><span className="text-muted">{money(o.total)}</span></button></li>)}</ul>
      </Card>
      <Card className="lg:col-span-2" title={order ? `Ticket ${order.number} — ${dateTime(order.createdAt)}` : 'Articles à retourner'}>
        {!order ? <Empty icon={<RotateCcw className="size-5" />} title="Sélectionnez une vente" text="Recherchez le ticket pour retourner ou échanger des articles." /> : (
          <>
            <ul className="divide-y divide-line">
              {order.items.map((i) => {
                const p = d.products.find((x) => x.id === i.productId)!
                return (
                  <li key={i.productId} className="flex items-center gap-3 py-2.5">
                    <ProductVisual shape={p.shape} color={p.color} brand={p.brand} className="size-10 rounded-lg" />
                    <div className="flex-1 text-sm">{p.name}<div className="text-xs text-muted">{i.qty} acheté(s) · {money(i.unitPrice, true)}</div></div>
                    <input type="number" min={0} max={i.qty} className="input h-8 w-20" value={qtys[i.productId] ?? 0} onChange={(e) => setQtys({ ...qtys, [i.productId]: Math.max(0, Math.min(i.qty, +e.target.value)) })} aria-label="Quantité retournée" />
                  </li>
                )
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-line">
              <Tabs value={mode} onChange={setMode} tabs={[{ id: 'remboursement', label: 'Remboursement' }, { id: 'avoir', label: 'Échange (avoir)' }]} />
              <div className="flex items-center gap-3"><span className="text-sm">Montant : <b>{money(refund, true)}</b></span><button className="btn-primary" disabled={!refund} onClick={submit}>Valider le retour</button></div>
            </div>
            <p className="text-xs text-muted mt-3">Les articles retournés sont réintégrés au stock de la boutique (lot le plus récent).</p>
          </>
        )}
      </Card>
    </div>
  )
}

function Register({ storeId }: { storeId: string }) {
  const d = useData()
  const [opening, setOpening] = useState(1000)
  const [counted, setCounted] = useState<number | ''>('')
  const todayStr = new Date().toISOString().slice(0, 10)
  const todays = d.orders.filter((o) => o.channel === 'pos' && o.storeId === storeId && o.createdAt.slice(0, 10) === todayStr)
  const cash = sum(todays.filter((o) => o.payment.method === 'especes'), (o) => o.total)
  const card = sum(todays.filter((o) => o.payment.method === 'carte'), (o) => o.total)
  const expected = opening + cash
  const byCashier = [...new Set(todays.map((o) => o.cashier ?? '—'))].map((c) => ({ c, n: todays.filter((o) => o.cashier === c).length, total: sum(todays.filter((o) => o.cashier === c), (o) => o.total) }))
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title="Session de caisse du jour">
        <div className="space-y-3">
          <Field label="Fond de caisse à l’ouverture"><input type="number" className="input" value={opening} onChange={(e) => setOpening(+e.target.value)} /></Field>
          <div className="rounded-xl bg-ivory border border-line p-3 text-sm space-y-1.5">
            <div className="flex justify-between"><span className="flex items-center gap-1.5 text-muted"><Banknote className="size-4" />Espèces</span><span className="tabular-nums">{money(cash, true)}</span></div>
            <div className="flex justify-between"><span className="flex items-center gap-1.5 text-muted"><CreditCard className="size-4" />Carte</span><span className="tabular-nums">{money(card, true)}</span></div>
            <div className="flex justify-between font-semibold pt-1 border-t border-line"><span>Total encaissé</span><span className="tabular-nums">{money(cash + card, true)}</span></div>
          </div>
          <Field label="Espèces comptées à la clôture"><input type="number" className="input" value={counted} onChange={(e) => setCounted(e.target.value === '' ? '' : +e.target.value)} placeholder={String(expected)} /></Field>
          {counted !== '' && <div className={cx('rounded-xl px-3 py-2 text-sm', counted === expected ? 'bg-sage-50 text-sage-700' : 'bg-amber-soft text-amber-ink')}>Écart : {counted - expected >= 0 ? '+' : ''}{money(counted - expected, true)}</div>}
          <button className="btn-primary w-full" onClick={() => toast('Caisse clôturée — rapport Z généré')}><Wallet className="size-4" /> Clôturer la caisse (Z)</button>
        </div>
      </Card>
      <Card title="Ventes par vendeur">
        <ul className="space-y-2">{byCashier.map((x) => <li key={x.c} className="flex justify-between text-sm"><span>{x.c}</span><span className="text-muted">{x.n} ventes · <b className="text-ink">{money(x.total)}</b></span></li>)}</ul>
        {!byCashier.length && <p className="text-sm text-muted">Aucune vente aujourd’hui.</p>}
      </Card>
      <Card title="Derniers tickets" padded={false}>
        <ul className="divide-y divide-line">{todays.slice(0, 10).map((o) => <li key={o.id} className="flex justify-between px-5 py-2.5 text-sm"><span>{o.number} <Badge tone={o.total < 0 ? 'rose' : 'neutral'}>{o.payment.method}</Badge></span><span className="tabular-nums">{money(o.total, true)}</span></li>)}</ul>
      </Card>
    </div>
  )
}
