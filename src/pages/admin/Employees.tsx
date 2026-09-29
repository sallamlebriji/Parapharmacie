import { Fragment, useState } from 'react'
import { Lock, Plus } from 'lucide-react'
import { actions, useData, useTenant } from '../../lib/store'
import { PLANS } from '../../data/plans'
import { iso, relative, uid } from '../../lib/format'
import { Avatar, Badge, Card, Field, Modal, PageHeader, Tabs, Toggle, toast } from '../../components/ui'
import { ROLE_LABEL } from '../../layouts/AdminLayout'
import type { Employee, Permission, Role } from '../../lib/types'

const PERMS: { group: string; items: { id: Permission; label: string }[] }[] = [
  { group: 'Ventes', items: [{ id: 'dashboard.view', label: 'Voir le tableau de bord' }, { id: 'ventes.manage', label: 'Consulter les ventes' }, { id: 'commandes.manage', label: 'Gérer les commandes' }, { id: 'pos.use', label: 'Utiliser la caisse' }, { id: 'pos.remise', label: 'Accorder des remises en caisse' }] },
  { group: 'Catalogue', items: [{ id: 'produits.view', label: 'Voir les produits' }, { id: 'produits.edit', label: 'Modifier les produits & prix de vente' }, { id: 'prix_achat.view', label: 'Voir les prix d’achat' }, { id: 'prix_achat.edit', label: 'Modifier les prix d’achat' }, { id: 'stock.manage', label: 'Gérer le stock & lots' }, { id: 'achats.manage', label: 'Achats & fournisseurs' }] },
  { group: 'Clients & marketing', items: [{ id: 'clients.manage', label: 'Clients & fidélité' }, { id: 'promotions.manage', label: 'Promotions & e-commerce' }, { id: 'marketing.manage', label: 'Campagnes marketing' }] },
  { group: 'Administration', items: [{ id: 'analytics.view', label: 'Analytics' }, { id: 'finance.view', label: 'Finance' }, { id: 'employes.manage', label: 'Employés & permissions' }, { id: 'parametres.manage', label: 'Paramètres & abonnement' }] },
]
const ROLES = Object.keys(ROLE_LABEL) as Role[]

export default function Employees() {
  const d = useData()
  const t = useTenant()
  const [tab, setTab] = useState<'equipe' | 'permissions'>('equipe')
  const [edit, setEdit] = useState<Employee | null>(null)
  const [invite, setInvite] = useState<{ email: string; pwd: string } | null>(null)
  const plan = PLANS.find((p) => p.id === t.plan)!
  const activeCount = d.employees.filter((e) => e.active).length

  return (
    <div>
      <PageHeader title="Employés" subtitle={`${activeCount} utilisateurs actifs sur ${plan.limits.users} inclus dans le plan ${plan.name}.`} actions={<>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'equipe', label: 'Équipe' }, { id: 'permissions', label: 'Rôles & permissions' }]} />
        <button className="btn-primary" disabled={activeCount >= plan.limits.users} onClick={() => setEdit({ id: uid('e'), name: '', email: '', role: 'vendeur', storeId: d.stores[0].id, active: true, lastLogin: iso(new Date()) })}><Plus className="size-4" /> Inviter</button>
      </>} />
      {tab === 'equipe' ? (
        <Card padded={false}>
          <table className="table-base">
            <thead><tr><th>Employé</th><th>Rôle</th><th>Boutique</th><th>Dernière connexion</th><th>Statut</th></tr></thead>
            <tbody>
              {d.employees.map((e) => (
                <tr key={e.id} className="cursor-pointer" onClick={() => setEdit(e)}>
                  <td><div className="flex items-center gap-2.5"><Avatar name={e.name} /><div><div className="font-medium">{e.name}</div><div className="text-[11px] text-muted">{e.email}</div></div></div></td>
                  <td><Badge tone={e.role === 'admin' ? 'dark' : e.role === 'manager' ? 'gold' : 'sage'}>{ROLE_LABEL[e.role]}</Badge></td>
                  <td className="text-muted">{d.stores.find((s) => s.id === e.storeId)?.name}</td>
                  <td className="text-muted">{relative(e.lastLogin)}</td>
                  <td><Badge tone={e.active ? 'sage' : 'neutral'} dot>{e.active ? 'Actif' : 'Désactivé'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="px-5 pt-4 pb-2 text-sm text-muted">Exemple : le vendeur peut encaisser et gérer les ventes, mais ne peut ni voir ni modifier les prix d’achat. Utilisez le menu profil (en haut à droite) pour prévisualiser l’interface d’un rôle.</div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Permission</th>{ROLES.map((r) => <th key={r} className="text-center">{ROLE_LABEL[r]}</th>)}</tr></thead>
              <tbody>
                {PERMS.map((g) => (
                  <Fragment key={g.group}>
                    <tr><td colSpan={ROLES.length + 1} className="!bg-ivory text-[11px] uppercase tracking-[0.12em] text-soft font-medium">{g.group}</td></tr>
                    {g.items.map((p) => (
                      <tr key={p.id}>
                        <td className="text-[13px]">{p.label}</td>
                        {ROLES.map((r) => (
                          <td key={r} className="text-center">
                            <div className="inline-flex">{r === 'admin' ? <Lock className="size-3.5 text-soft" /> : <Toggle on={d.permissions[r].includes(p.id)} onChange={() => actions.togglePermission(r, p.id)} label={`${ROLE_LABEL[r]} — ${p.label}`} />}</div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.name || 'Inviter un employé'} footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Annuler</button><button className="btn-primary" onClick={() => { if (!edit.name || !edit.email) return toast('Nom et email requis'); actions.saveEmployee(edit).then((pwd) => { setEdit(null); if (pwd) setInvite({ email: edit.email, pwd }); else toast('Employé mis à jour') }).catch(() => {}) }}>Enregistrer</button></>}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom complet" className="col-span-2"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Email professionnel" className="col-span-2"><input type="email" className="input" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Rôle"><select className="input" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
            <Field label="Boutique"><select className="input" value={edit.storeId} onChange={(e) => setEdit({ ...edit, storeId: e.target.value })}>{d.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <label className="col-span-2 flex items-center gap-2 text-sm mt-2"><Toggle on={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Actif" /> Compte actif</label>
          </div>
        </Modal>
      )}
      {invite && (
        <Modal open onClose={() => setInvite(null)} title="Compte créé" footer={<button className="btn-primary" onClick={() => setInvite(null)}>J’ai transmis le mot de passe</button>}>
          <p className="text-sm text-muted">Transmettez ces identifiants à l’employé. Le mot de passe temporaire n’est affiché qu’une seule fois.</p>
          <div className="mt-4 rounded-xl bg-ivory border border-line p-4 text-sm space-y-1">
            <div>Email : <b>{invite.email}</b></div>
            <div>Mot de passe temporaire : <code className="font-mono bg-surface border border-line rounded px-1.5 py-0.5">{invite.pwd}</code></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
