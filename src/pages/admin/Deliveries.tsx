import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plug, Plus, Truck, Zap } from 'lucide-react'
import { actions, useData } from '../../lib/store'
import { dateTime, money, uid } from '../../lib/format'
import { Badge, Card, Field, Modal, ORDER_STATUS, PageHeader, Stat, StatusBadge, Toggle, toast } from '../../components/ui'
import type { DeliveryZone } from '../../lib/types'

const CARRIERS = [
  { name: 'Coursier interne', desc: 'Vos livreurs, suivi dans l’application employé', status: 'connecte' },
  { name: 'Amana Express', desc: 'Réseau national, points relais', status: 'connecte' },
  { name: 'CTM Messagerie', desc: 'Livraison inter-villes', status: 'disponible' },
  { name: 'Aramex', desc: 'Express national & international', status: 'disponible' },
  { name: 'API / Webhook', desc: 'Connectez n’importe quel transporteur', status: 'disponible' },
]

export default function Deliveries() {
  const d = useData()
  const [edit, setEdit] = useState<DeliveryZone | null>(null)
  const inTransit = d.orders.filter((o) => o.channel === 'web' && (o.status === 'expediee' || o.status === 'livraison' || o.status === 'preparation'))
  const delivered30 = d.orders.filter((o) => o.channel === 'web' && o.status === 'livree' && Date.now() - new Date(o.createdAt).getTime() < 30 * 864e5)
  const express = delivered30.filter((o) => o.delivery?.mode === 'express').length

  return (
    <div>
      <PageHeader title="Livraisons" subtitle="Zones, tarifs, modes de livraison et suivi des expéditions." actions={<button className="btn-primary" onClick={() => setEdit({ id: uid('z'), name: '', cities: [], standardFee: 30, expressFee: 60, freeAbove: 500, standardDelay: '24–48 h', expressDelay: '24 h', active: true })}><Plus className="size-4" /> Zone</button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="En cours de livraison" value={inTransit.length} tone="gold" icon={<Truck className="size-4" />} />
        <Stat label="Livrées (30 j)" value={delivered30.length} />
        <Stat label="Part express" value={`${delivered30.length ? Math.round((express / delivered30.length) * 100) : 0} %`} tone="sky" icon={<Zap className="size-4" />} />
        <Stat label="Livraisons offertes" value={`${delivered30.length ? Math.round((delivered30.filter((o) => o.shipping === 0).length / delivered30.length) * 100) : 0} %`} tone="gold" />
      </div>
      <Card title="Zones & tarifs" padded={false} className="mb-4">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Zone</th><th>Villes</th><th className="text-right">Standard</th><th className="text-right">Express</th><th className="text-right">Gratuite dès</th><th>Délais</th><th>Active</th></tr></thead>
            <tbody>
              {d.zones.map((z) => (
                <tr key={z.id} className="cursor-pointer" onClick={() => setEdit(z)}>
                  <td className="font-medium">{z.name}</td>
                  <td className="text-muted text-xs max-w-64">{z.cities.join(', ')}</td>
                  <td className="text-right tabular-nums">{money(z.standardFee)}</td>
                  <td className="text-right tabular-nums">{money(z.expressFee)}</td>
                  <td className="text-right tabular-nums">{money(z.freeAbove)}</td>
                  <td className="text-xs text-muted whitespace-nowrap">Std {z.standardDelay} · Exp {z.expressDelay}</td>
                  <td onClick={(e) => e.stopPropagation()}><Toggle on={z.active} onChange={(v) => actions.saveZone({ ...z, active: v })} label="Active" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Expéditions en cours" padded={false} className="lg:col-span-2">
          <table className="table-base">
            <thead><tr><th>Commande</th><th>Adresse</th><th>Mode</th><th>Transporteur</th><th>Statut</th></tr></thead>
            <tbody>
              {inTransit.slice(0, 15).map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/admin/commandes/${o.id}`} className="font-medium hover:text-sage-600">{o.number}</Link><div className="text-[11px] text-muted">{dateTime(o.createdAt)}</div></td>
                  <td className="text-xs">{o.delivery?.address}<div className="text-muted">{o.delivery?.city}</div></td>
                  <td>{o.delivery?.mode === 'express' ? <Badge tone="gold">Express</Badge> : <Badge>Standard</Badge>}</td>
                  <td className="text-xs">{o.delivery?.carrier ?? '—'}{o.delivery?.tracking && <div className="font-mono text-muted">{o.delivery.tracking}</div>}</td>
                  <td><StatusBadge map={ORDER_STATUS} value={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title={<span className="flex items-center gap-2"><Plug className="size-4 text-sage-500" /> Transporteurs</span>}>
          <ul className="space-y-2">
            {CARRIERS.map((c) => (
              <li key={c.name} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <div className="flex-1"><div className="text-sm font-medium">{c.name}</div><div className="text-[11px] text-muted">{c.desc}</div></div>
                {c.status === 'connecte' ? <Badge tone="sage" dot>Connecté</Badge> : <button className="btn-secondary btn-sm" onClick={() => toast(`Connecteur ${c.name} : saisissez vos identifiants API dans Paramètres › Intégrations`)}>Connecter</button>}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted mt-3">Architecture par connecteurs : chaque transporteur implémente la même interface (création d’envoi, étiquette, suivi par webhook).</p>
        </Card>
      </div>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.name || 'Nouvelle zone'} footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Annuler</button><button className="btn-primary" onClick={() => { actions.saveZone(edit).then(() => toast('Zone enregistrée')).catch(() => {}); setEdit(null) }}>Enregistrer</button></>}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom" className="col-span-2"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Villes (séparées par des virgules)" className="col-span-2"><input className="input" value={edit.cities.join(', ')} onChange={(e) => setEdit({ ...edit, cities: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
            <Field label="Frais standard (DH)"><input type="number" className="input" value={edit.standardFee} onChange={(e) => setEdit({ ...edit, standardFee: +e.target.value })} /></Field>
            <Field label="Frais express (DH)"><input type="number" className="input" value={edit.expressFee} onChange={(e) => setEdit({ ...edit, expressFee: +e.target.value })} /></Field>
            <Field label="Livraison gratuite dès (DH)"><input type="number" className="input" value={edit.freeAbove} onChange={(e) => setEdit({ ...edit, freeAbove: +e.target.value })} /></Field>
            <Field label="Délai standard"><input className="input" value={edit.standardDelay} onChange={(e) => setEdit({ ...edit, standardDelay: e.target.value })} /></Field>
            <Field label="Délai express"><input className="input" value={edit.expressDelay} onChange={(e) => setEdit({ ...edit, expressDelay: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
