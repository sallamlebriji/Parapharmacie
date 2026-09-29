import { useState } from 'react'
import { Bot, CheckCheck, MessageCircle, Send } from 'lucide-react'
import { actions, useData } from '../../lib/store'
import { dateTime, relative } from '../../lib/format'
import { Avatar, Badge, Card, Empty, PageHeader, Tabs, cx, toast } from '../../components/ui'

const QUICK = ['Bonjour, merci pour votre message. Je regarde cela tout de suite.', 'Votre commande est en cours de préparation et partira aujourd’hui.', 'Pour toute question médicale, nous vous conseillons de consulter votre médecin ou pharmacien.']

export default function Messages() {
  const d = useData()
  const [filter, setFilter] = useState<'ouvert' | 'resolu'>('ouvert')
  const list = d.chats.filter((c) => c.status === filter)
  const [sel, setSel] = useState<string | null>(list[0]?.id ?? null)
  const [text, setText] = useState('')
  const thread = d.chats.find((c) => c.id === sel)
  const send = (t = text) => { if (!t.trim() || !thread) return; void actions.sendChat(thread.id, t.trim()); setText('') }

  return (
    <div>
      <PageHeader title="Messages clients" subtitle="Questions produits, suivi de commandes et assistance — depuis la boutique en ligne." />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card padded={false}>
          <div className="p-3"><Tabs value={filter} onChange={setFilter} tabs={[{ id: 'ouvert', label: 'Ouverts', count: d.chats.filter((c) => c.status === 'ouvert').length }, { id: 'resolu', label: 'Résolus' }]} /></div>
          {list.length === 0 ? <Empty icon={<MessageCircle className="size-5" />} title="Aucune conversation" /> : (
            <ul className="divide-y divide-line">
              {list.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setSel(c.id)} className={cx('w-full text-left flex gap-3 px-4 py-3 cursor-pointer', sel === c.id ? 'bg-sage-50' : 'hover:bg-ivory')}>
                    <Avatar name={c.customer} />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2"><span className="text-sm font-medium truncate">{c.customer}</span><span className="text-[11px] text-soft shrink-0">{relative(c.messages[c.messages.length - 1].date)}</span></div>
                      <div className="text-xs text-muted truncate">{c.subject}</div>
                      <Badge className="mt-1" tone={c.topic === 'commande' ? 'gold' : c.topic === 'produit' ? 'sage' : 'sky'}>{c.topic}</Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card padded={false} className="lg:col-span-2 flex flex-col min-h-[520px]">
          {!thread ? <Empty title="Sélectionnez une conversation" /> : (
            <>
              <header className="flex items-center justify-between px-5 py-3 border-b border-line">
                <div><div className="font-medium">{thread.customer}</div><div className="text-xs text-muted">{thread.subject}</div></div>
                {thread.status === 'ouvert' && <button className="btn-secondary btn-sm" onClick={() => { actions.resolveChat(thread.id).then(() => toast('Conversation résolue')).catch(() => {}) }}><CheckCheck className="size-3.5" /> Résoudre</button>}
              </header>
              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-ivory">
                {thread.messages.map((m, i) => (
                  <div key={i} className={cx('flex', m.from === 'client' ? 'justify-start' : 'justify-end')}>
                    <div className={cx('max-w-[75%] rounded-2xl px-4 py-2.5 text-sm', m.from === 'client' ? 'bg-surface border border-line' : m.from === 'bot' ? 'bg-champagne-100 text-ink' : 'bg-accent text-on-accent')}>
                      {m.from === 'bot' && <div className="text-[10px] uppercase tracking-wider text-champagne-600 flex items-center gap-1 mb-1"><Bot className="size-3" /> Assistant automatique</div>}
                      {m.text}
                      <div className={cx('text-[10px] mt-1', m.from === 'staff' ? 'text-sage-100' : 'text-soft')}>{dateTime(m.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-line">
                <div className="flex gap-1.5 mb-2 overflow-x-auto scrollbar-thin">{QUICK.map((q) => <button key={q} onClick={() => send(q)} className="chip bg-cream text-muted hover:text-ink cursor-pointer shrink-0 max-w-64 truncate">{q}</button>)}</div>
                <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex gap-2">
                  <input className="input" placeholder="Votre réponse…" value={text} onChange={(e) => setText(e.target.value)} />
                  <button className="btn-primary" aria-label="Envoyer"><Send className="size-4" /></button>
                </form>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
