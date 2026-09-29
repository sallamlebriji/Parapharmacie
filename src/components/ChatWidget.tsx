import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, MessageCircle, Send, X } from 'lucide-react'
import { actions, useData, useShopCustomer } from '../lib/store'
import { money } from '../lib/format'
import { ORDER_STATUS, cx } from './ui'

type Msg = { from: 'user' | 'bot' | 'staff'; text: string; links?: { to: string; label: string }[] }

const MEDICAL = /(douleur|allerg|infect|m[ée]dicament|enceinte|grossesse|sympt|traitement|diagnos|maladie|ecz[ée]ma|psoriasis|br[ûu]lure|saign|fi[èe]vre|urgence|posologie|interaction|ordonnance|plaie|mycose)/i

export function ChatWidget() {
  const d = useData()
  const me = useShopCustomer()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [threadId, setThreadId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'bot', text: 'Bonjour 👋 Je suis l’assistant de la boutique. Je peux vous aider à trouver un produit, suivre une commande ou répondre à vos questions sur la livraison et la fidélité.' }])
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, open])

  // Staff replies from the back-office appear in the widget.
  const thread = d.chats.find((c) => c.id === threadId)
  const staffMsgs = thread?.messages.filter((m) => m.from === 'staff') ?? []
  const seen = useRef(0)
  useEffect(() => {
    if (staffMsgs.length > seen.current) { setMsgs((m) => [...m, ...staffMsgs.slice(seen.current).map((s) => ({ from: 'staff' as const, text: s.text }))]); seen.current = staffMsgs.length }
  }, [staffMsgs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (q: string): Msg => {
    const s = q.toLowerCase()
    if (MEDICAL.test(s)) return { from: 'bot', text: 'Votre question semble relever d’un avis de santé. Je ne peux pas établir de diagnostic ni conseiller un traitement : merci de consulter votre médecin ou votre pharmacien. Nos conseillers peuvent vous orienter vers des produits de soin adaptés, sans remplacer cet avis.', links: [{ to: '#human', label: 'Parler à un conseiller' }] }
    const num = s.match(/(web|pos)-?\d{4,6}/i)
    if (num) {
      const o = d.orders.find((x) => x.number.toLowerCase() === num[0].toLowerCase().replace(/(web|pos)(\d)/, '$1-$2'))
      return o ? { from: 'bot', text: `La commande ${o.number} est actuellement : ${ORDER_STATUS[o.status].label}. Montant : ${money(o.total)}.`, links: [{ to: `/boutique/suivi/${o.id}`, label: 'Voir le suivi détaillé' }] } : { from: 'bot', text: 'Je ne trouve pas cette commande. Vérifiez le numéro (ex. WEB-12345).' }
    }
    if (/commande|colis|suivi/.test(s)) return { from: 'bot', text: 'Indiquez-moi votre numéro de commande (ex. WEB-12345) et je vous donne son statut.' }
    if (/livr|exp[ée]di|frais de port/.test(s)) { const z = d.zones[0]; return { from: 'bot', text: `Livraison standard dès ${money(z.standardFee)} (${z.standardDelay}), express ${money(z.expressFee)} (${z.expressDelay}). Offerte dès ${money(z.freeAbove)} d’achat dans votre zone.` } }
    if (/retour|rembours|[ée]change/.test(s)) return { from: 'bot', text: 'Les produits non ouverts peuvent être échangés ou remboursés sous 14 jours, en boutique ou par retour colis.' }
    if (/fid[ée]lit|point/.test(s)) return { from: 'bot', text: `Vous gagnez 1 point pour 10 DH dépensés, utilisables en réduction. Niveaux : Basic, Silver, Gold, VIP.${me ? ` Vous avez actuellement ${me.customer.points} points.` : ''}`, links: [{ to: '/boutique/compte', label: 'Mon espace fidélité' }] }
    if (/paiement|payer|carte/.test(s)) return { from: 'bot', text: 'Paiement par carte bancaire sécurisé ou en espèces à la livraison.' }
    if (/routine|quiz|conseil|peau/.test(s)) return { from: 'bot', text: 'Notre quiz vous propose une routine personnalisée en 1 minute.', links: [{ to: '/boutique/quiz', label: 'Faire le quiz' }, { to: '/boutique/routines', label: 'Voir les routines' }] }
    const found = d.products.filter((p) => s.split(/\s+/).filter((w) => w.length > 3).some((w) => `${p.name} ${p.brand} ${p.subcategory}`.toLowerCase().includes(w))).slice(0, 3)
    if (found.length) return { from: 'bot', text: 'Voici quelques produits qui pourraient correspondre :', links: found.map((p) => ({ to: `/boutique/produit/${p.id}`, label: `${p.name} — ${money(p.price)}` })) }
    return { from: 'bot', text: 'Je transmets volontiers votre question à un conseiller de la parapharmacie.', links: [{ to: '#human', label: 'Parler à un conseiller' }] }
  }

  // While a conversation with a human is open, poll it for staff replies.
  useEffect(() => {
    if (!threadId || !open) return
    const t = setInterval(() => { actions.shopChatRefresh(threadId).catch(() => {}) }, 5000)
    return () => clearInterval(t)
  }, [threadId, open])

  const human = async () => {
    if (threadId) return
    const last = [...msgs].reverse().find((m) => m.from === 'user')?.text ?? 'Demande d’assistance'
    const name = me ? `${me.customer.firstName} ${me.customer.lastName}` : 'Visiteur'
    const history = msgs.slice(1).filter((m) => m.from !== 'staff').slice(-8).map((m) => ({ from: m.from === 'user' ? ('client' as const) : ('bot' as const), text: m.text }))
    try {
      const id = await actions.shopChatStart(last, { name, topic: /commande/i.test(last) ? 'commande' : 'produit', history: history.slice(0, -1) })
      setThreadId(id)
      setMsgs((m) => [...m, { from: 'bot', text: 'Un conseiller a été notifié et vous répond ici dans quelques minutes (9h–20h).' }])
    } catch { /* toast shown */ }
  }
  const send = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    const q = text.trim()
    setText('')
    if (threadId) { void actions.shopChatSend(threadId, q); setMsgs((m) => [...m, { from: 'user', text: q }]); return }
    setMsgs((m) => [...m, { from: 'user', text: q }, answer(q)])
  }

  return (
    <>
      <button onClick={() => setOpen(!open)} className="fixed bottom-5 right-5 z-40 size-14 rounded-full bg-accent text-on-accent shadow-lift grid place-items-center hover:bg-accent-hover transition cursor-pointer" aria-label="Assistance">
        {open ? <X className="size-5" /> : <MessageCircle className="size-6" />}
      </button>
      {open && (
        <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:w-96 z-40 card shadow-lift flex flex-col h-[520px] max-h-[70vh] animate-fade-up overflow-hidden">
          <header className="px-4 py-3 bg-accent text-on-accent flex items-center gap-3">
            <span className="size-9 rounded-full bg-white/15 grid place-items-center"><Bot className="size-5" /></span>
            <div><div className="text-sm font-medium">Assistance & conseils</div><div className="text-[11px] text-sage-100">Réponse immédiate · conseillers 9h–20h</div></div>
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-ivory scrollbar-thin">
            {msgs.map((m, i) => (
              <div key={i} className={cx('flex', m.from === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cx('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed', m.from === 'user' ? 'bg-accent text-on-accent' : m.from === 'staff' ? 'bg-champagne-100' : 'bg-surface border border-line')}>
                  {m.from === 'staff' && <div className="text-[10px] uppercase tracking-wider text-champagne-600 mb-0.5">Conseiller</div>}
                  {m.text}
                  {m.links && <div className="mt-2 flex flex-col gap-1">{m.links.map((l) => l.to === '#human'
                    ? <button key={l.label} onClick={human} className="text-left text-sage-600 font-medium hover:underline cursor-pointer">→ {l.label}</button>
                    : <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="text-sage-600 font-medium hover:underline">→ {l.label}</Link>)}</div>}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          {!threadId && <div className="px-3 pt-2 flex gap-1.5 overflow-x-auto scrollbar-thin">{['Suivre ma commande', 'Frais de livraison', 'Trouver ma routine', 'Retours'].map((q) => <button key={q} onClick={() => setMsgs((m) => [...m, { from: 'user', text: q }, answer(q)])} className="chip bg-cream text-muted hover:text-ink cursor-pointer shrink-0">{q}</button>)}</div>}
          <form onSubmit={send} className="p-3 flex gap-2">
            <input className="input" placeholder="Écrivez votre message…" value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn-primary px-3" aria-label="Envoyer"><Send className="size-4" /></button>
          </form>
          <p className="px-3 pb-2 text-[10px] text-soft leading-tight">L’assistant ne fournit pas d’avis médical. En cas de problème de santé, consultez un professionnel.</p>
        </div>
      )}
    </>
  )
}
