import { useMemo, useState } from 'react'
import { Bell, Mail, MessageSquare, Plus, Send, ShoppingCart, Sparkles } from 'lucide-react'
import { actions, useData, useTenant } from '../../lib/store'
import { date, money, pct, sum, uid, iso } from '../../lib/format'
import { customerStats, type Segment } from '../../lib/logic'
import { Badge, Card, Field, Modal, PageHeader, Stat, Toggle, cx, toast } from '../../components/ui'
import type { Campaign } from '../../lib/types'

const AUTOMATIONS = [
  { id: 'cart', icon: ShoppingCart, name: 'Abandon de panier', desc: '« Vous avez oublié quelque chose dans votre panier. » — 1 h puis 24 h après l’abandon', on: true },
  { id: 'inactive', icon: Sparkles, name: 'Relance clients inactifs', desc: 'Code −15 % après 90 jours sans achat', on: true },
  { id: 'restock', icon: Bell, name: 'Retour en stock', desc: 'Prévenir les clients ayant le produit en favoris', on: true },
  { id: 'price', icon: Bell, name: 'Baisse de prix', desc: 'Alerte aux clients ayant le produit dans leur wishlist', on: true },
  { id: 'review', icon: MessageSquare, name: 'Demande d’avis', desc: '5 jours après la livraison', on: true },
  { id: 'birthday', icon: Mail, name: 'Anniversaire', desc: 'Bon de 50 DH le mois de l’anniversaire', on: false },
  { id: 'replenish', icon: Sparkles, name: 'Réassort intelligent', desc: 'Rappel quand le produit habituel est bientôt terminé (≈ 45 j)', on: false },
]
const CHANNEL = { email: { label: 'Email', icon: Mail }, sms: { label: 'SMS', icon: MessageSquare }, push: { label: 'Notification', icon: Bell } }

export default function Marketing() {
  const d = useData()
  const [autos, setAutos] = useState(AUTOMATIONS)
  const [edit, setEdit] = useState<Campaign | null>(null)
  const sent = d.campaigns.filter((c) => c.sent > 0)
  const emails = sent.filter((c) => c.channel === 'email')

  return (
    <div>
      <PageHeader title="Marketing" subtitle="Campagnes, segmentation, automatisations et relances clients." actions={<button className="btn-primary" onClick={() => setEdit({ id: uid('cp'), name: '', channel: 'email', segment: 'Tous les clients (opt-in)', status: 'brouillon', sent: 0, opened: 0, clicked: 0, revenue: 0, date: iso(new Date()), subject: '' })}><Plus className="size-4" /> Campagne</button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Messages envoyés" value={sum(sent, (c) => c.sent).toLocaleString('fr-FR')} />
        <Stat label="Taux d’ouverture email" value={pct((sum(emails, (c) => c.opened) / Math.max(1, sum(emails, (c) => c.sent))) * 100, 0)} tone="sky" />
        <Stat label="Taux de clic" value={pct((sum(sent, (c) => c.clicked) / Math.max(1, sum(sent, (c) => c.sent))) * 100, 1)} tone="gold" />
        <Stat label="CA attribué" value={money(sum(d.campaigns, (c) => c.revenue))} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Campagnes" padded={false} className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Campagne</th><th>Canal</th><th>Segment</th><th className="text-right">Envoyés</th><th className="text-right">Ouverture</th><th className="text-right">CA</th><th>Statut</th></tr></thead>
              <tbody>
                {d.campaigns.map((c) => {
                  const Ch = CHANNEL[c.channel]
                  return (
                    <tr key={c.id} className="cursor-pointer" onClick={() => setEdit(c)}>
                      <td><div className="font-medium">{c.name}</div><div className="text-[11px] text-muted truncate max-w-64">{c.subject}</div></td>
                      <td><span className="inline-flex items-center gap-1.5 text-xs"><Ch.icon className="size-3.5 text-soft" />{Ch.label}</span></td>
                      <td className="text-xs text-muted">{c.segment}</td>
                      <td className="text-right tabular-nums">{c.sent || '—'}</td>
                      <td className="text-right tabular-nums">{c.sent && c.channel !== 'sms' ? pct((c.opened / c.sent) * 100, 0) : '—'}</td>
                      <td className="text-right tabular-nums">{c.revenue ? money(c.revenue) : '—'}</td>
                      <td><Badge tone={{ brouillon: 'neutral', programmee: 'sky', envoyee: 'sage', auto: 'gold' }[c.status]} dot>{{ brouillon: 'Brouillon', programmee: `Programmée ${date(c.date, { day: '2-digit', month: 'short' })}`, envoyee: 'Envoyée', auto: 'Automatique' }[c.status]}</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Automatisations">
          <ul className="space-y-3">
            {autos.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <span className="size-8 rounded-lg bg-sage-50 text-sage-600 grid place-items-center shrink-0"><a.icon className="size-4" /></span>
                <div className="flex-1 min-w-0"><div className="text-sm font-medium">{a.name}</div><div className="text-[11px] text-muted leading-snug">{a.desc}</div></div>
                <Toggle on={a.on} onChange={(v) => { setAutos(autos.map((x) => (x.id === a.id ? { ...x, on: v } : x))); toast(`${a.name} ${v ? 'activée' : 'désactivée'}`) }} label={a.name} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {edit && <CampaignModal campaign={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

const SEGMENT_OPTIONS: { label: string; seg?: Segment }[] = [
  { label: 'Tous les clients (opt-in)' },
  { label: 'Nouveaux clients', seg: 'nouveau' },
  { label: 'Clients réguliers', seg: 'regulier' },
  { label: 'Clients VIP', seg: 'vip' },
  { label: 'Clients inactifs', seg: 'inactif' },
  { label: 'Clients occasionnels', seg: 'occasionnel' },
]

function CampaignModal({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const d = useData()
  const t = useTenant()
  const [c, setC] = useState(campaign)
  const [body, setBody] = useState('Bonjour {prénom},\n\nDécouvrez notre sélection du moment, pensée pour prendre soin de vous.\n\nÀ très vite en boutique ou en ligne !')
  const segs = useMemo(() => new Map(d.customers.map((x) => [x.id, customerStats(d, x).segment])), [d])
  const opt = SEGMENT_OPTIONS.find((o) => o.label === c.segment)
  const audience = d.customers.filter((x) => x.marketingOptIn && (!opt?.seg || segs.get(x.id) === opt.seg)).length
  const readOnly = c.status === 'envoyee' || c.status === 'auto'
  const save = async (status: Campaign['status']) => {
    if (!c.name) return toast('Nommez la campagne', 'error')
    const sent = await actions.saveCampaign({ ...c, status })
    toast(status === 'envoyee' ? `Campagne envoyée à ${sent ?? audience} clients` : status === 'programmee' ? 'Campagne programmée' : 'Brouillon enregistré')
    onClose()
  }
  return (
    <Modal open wide onClose={onClose} title={campaign.name || 'Nouvelle campagne'} footer={!readOnly && <>
      <button className="btn-secondary" onClick={() => save('brouillon')}>Brouillon</button>
      <button className="btn-secondary" onClick={() => save('programmee')}>Programmer</button>
      <button className="btn-primary" onClick={() => save('envoyee')}><Send className="size-4" /> Envoyer à {audience}</button>
    </>}>
      <div className="grid md:grid-cols-2 gap-5">
        <fieldset disabled={readOnly} className="space-y-3">
          <Field label="Nom interne"><input className="input" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
          <Field label="Canal">
            <div className="grid grid-cols-3 gap-2">{(Object.keys(CHANNEL) as Campaign['channel'][]).map((k) => { const Ch = CHANNEL[k]; return <button type="button" key={k} onClick={() => setC({ ...c, channel: k })} className={cx('rounded-xl border py-2 text-xs flex flex-col items-center gap-1 cursor-pointer', c.channel === k ? 'border-sage-500 bg-sage-50 text-sage-700' : 'border-line text-muted')}><Ch.icon className="size-4" />{Ch.label}</button> })}</div>
          </Field>
          <Field label="Segment" hint={`${audience} destinataires (clients ayant accepté les communications)`}>
            <select className="input" value={c.segment} onChange={(e) => setC({ ...c, segment: e.target.value })}>{SEGMENT_OPTIONS.map((o) => <option key={o.label}>{o.label}</option>)}{!opt && <option>{c.segment}</option>}</select>
          </Field>
          <Field label={c.channel === 'email' ? 'Objet' : 'Titre'}><input className="input" value={c.subject} onChange={(e) => setC({ ...c, subject: e.target.value })} /></Field>
          <Field label="Message"><textarea rows={5} className="input" value={body} onChange={(e) => setBody(e.target.value)} /></Field>
          <Field label="Date d’envoi"><input type="datetime-local" className="input" value={c.date.slice(0, 16)} onChange={(e) => setC({ ...c, date: iso(new Date(e.target.value)) })} /></Field>
        </fieldset>
        <div>
          <div className="label">Aperçu</div>
          <div className="rounded-2xl border border-line bg-cream p-4">
            <div className="bg-white rounded-xl shadow-soft overflow-hidden">
              <div className="px-5 py-4 text-center border-b border-line" style={{ background: t.primaryColor, color: '#fff' }}><div className="font-display text-lg">{t.name}</div></div>
              <div className="p-5">
                <div className="font-medium">{c.subject || 'Objet de votre message'}</div>
                <p className="text-sm text-muted whitespace-pre-line mt-3">{body.replace('{prénom}', 'Salma')}</p>
                <div className="mt-4 text-center"><span className="inline-block btn-primary pointer-events-none">Découvrir</span></div>
              </div>
              <div className="px-5 py-3 text-[10px] text-soft text-center border-t border-line">Vous recevez cet email car vous êtes client·e de {t.name}. Se désinscrire.</div>
            </div>
          </div>
          {readOnly && c.sent > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div className="card p-2"><div className="font-semibold">{c.sent}</div><div className="text-[10px] text-muted">Envoyés</div></div>
              <div className="card p-2"><div className="font-semibold">{c.clicked}</div><div className="text-[10px] text-muted">Clics</div></div>
              <div className="card p-2"><div className="font-semibold">{money(c.revenue)}</div><div className="text-[10px] text-muted">CA</div></div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
