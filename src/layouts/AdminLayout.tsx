import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3, Bell, Loader2, LogOut, Boxes, Building2, CalendarClock, CircleDollarSign, ClipboardList, ExternalLink, Gift, LayoutDashboard,
  Megaphone, Menu, MessageCircle, Monitor, Package, Percent, Receipt, Search, Settings, ShoppingBag, Store, Truck, UserCog, Users, Warehouse, X,
} from 'lucide-react'
import { actions, useApp, useCan, useSession } from '../lib/store'
import { relative } from '../lib/format'
import { Avatar, cx } from '../components/ui'
import { Logo } from '../components/Logo'
import type { Permission, Role } from '../lib/types'

const NAV: { group: string; items: { to: string; label: string; icon: typeof LayoutDashboard; perm?: Permission }[] }[] = [
  { group: 'Pilotage', items: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view' },
    { to: '/admin/ventes', label: 'Ventes', icon: Receipt, perm: 'ventes.manage' },
    { to: '/admin/commandes', label: 'Commandes', icon: ClipboardList, perm: 'commandes.manage' },
  ] },
  { group: 'Catalogue & stock', items: [
    { to: '/admin/produits', label: 'Produits', icon: Package, perm: 'produits.view' },
    { to: '/admin/stock', label: 'Stock', icon: Boxes, perm: 'stock.manage' },
    { to: '/admin/lots', label: 'Lots & Expiration', icon: CalendarClock, perm: 'stock.manage' },
    { to: '/admin/achats', label: 'Achats', icon: ShoppingBag, perm: 'achats.manage' },
    { to: '/admin/fournisseurs', label: 'Fournisseurs', icon: Warehouse, perm: 'achats.manage' },
  ] },
  { group: 'Clients & ventes', items: [
    { to: '/admin/clients', label: 'Clients', icon: Users, perm: 'clients.manage' },
    { to: '/admin/fidelite', label: 'Fidélité', icon: Gift, perm: 'clients.manage' },
    { to: '/admin/promotions', label: 'Promotions', icon: Percent, perm: 'promotions.manage' },
    { to: '/admin/ecommerce', label: 'E-commerce', icon: Store, perm: 'promotions.manage' },
    { to: '/admin/pos', label: 'POS', icon: Monitor, perm: 'pos.use' },
    { to: '/admin/livraisons', label: 'Livraisons', icon: Truck, perm: 'commandes.manage' },
    { to: '/admin/marketing', label: 'Marketing', icon: Megaphone, perm: 'marketing.manage' },
  ] },
  { group: 'Entreprise', items: [
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, perm: 'analytics.view' },
    { to: '/admin/employes', label: 'Employés', icon: UserCog, perm: 'employes.manage' },
    { to: '/admin/boutiques', label: 'Boutiques', icon: Building2, perm: 'dashboard.view' },
    { to: '/admin/finance', label: 'Finance', icon: CircleDollarSign, perm: 'finance.view' },
    { to: '/admin/parametres', label: 'Paramètres', icon: Settings, perm: 'parametres.manage' },
  ] },
]

export const ROLE_LABEL: Record<Role, string> = { admin: 'Administrateur', manager: 'Manager', vendeur: 'Vendeur', stock: 'Gestionnaire stock', preparateur: 'Préparateur' }

function useOutside(ref: React.RefObject<HTMLElement>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && cb()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, cb])
}

function Dropdown({ trigger, children, align = 'right', width = 'w-72' }: { trigger: (open: boolean) => React.ReactNode; children: (close: () => void) => React.ReactNode; align?: 'left' | 'right'; width?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false))
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div className={cx('absolute z-40 mt-2 card shadow-lift p-1.5 animate-fade-up', width, align === 'right' ? 'right-0' : 'left-0')}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

/** Auth gate: redirects to login, loads the tenant snapshot from the API, then keeps it in sync. */
export default function AdminLayout() {
  const token = useApp((s) => s.token)
  const ready = useApp((s) => !!s.data && !!s.tenant)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!token || ready) return
    actions.loadBootstrap().catch((e) => setError(e.message))
  }, [token, ready])
  useEffect(() => {
    if (!ready) return
    const t = setInterval(() => { actions.sync().catch(() => {}) }, 20_000)
    return () => clearInterval(t)
  }, [ready])
  if (!token) return <Navigate to="/connexion" replace />
  if (!ready) return (
    <div className="min-h-screen grid place-items-center bg-ivory text-sm text-muted">
      {error ? <div className="text-center"><p className="text-rose-ink">{error}</p><button className="btn-secondary mt-4" onClick={() => { setError(''); actions.loadBootstrap().catch((e) => setError(e.message)) }}>Réessayer</button></div>
        : <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Chargement de votre espace…</span>}
    </div>
  )
  return <AdminShell />
}

function AdminShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()
  const tenant = useApp((s) => s.tenant!)
  const d = useApp((s) => s.data!)
  const session = useSession()
  const can = useCan()
  const [q, setQ] = useState('')
  useEffect(() => setMobileOpen(false), [loc.pathname])

  const unread = d.notifications.filter((n) => !n.read).length
  const openChats = d.chats.filter((c) => c.status === 'ouvert').length
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    const prods = d.products.filter((p) => `${p.name} ${p.brand} ${p.ref} ${p.barcode}`.toLowerCase().includes(s)).slice(0, 5).map((p) => ({ label: p.name, sub: `${p.brand} · ${p.ref}`, to: `/admin/produits/${p.id}` }))
    const custs = d.customers.filter((c) => `${c.firstName} ${c.lastName} ${c.phone} ${c.email}`.toLowerCase().includes(s)).slice(0, 4).map((c) => ({ label: `${c.firstName} ${c.lastName}`, sub: c.phone, to: `/admin/clients/${c.id}` }))
    const ords = d.orders.filter((o) => o.number.toLowerCase().includes(s)).slice(0, 4).map((o) => ({ label: o.number, sub: `${o.total} DH`, to: `/admin/commandes/${o.id}` }))
    return [...prods, ...custs, ...ords]
  }, [q, d])

  const sidebar = (
    <nav className="flex flex-col h-full">
      <div className="px-5 h-16 flex items-center justify-between border-b border-line">
        <Link to="/admin"><Logo /></Link>
        <button className="lg:hidden btn-ghost h-8 w-8 p-0" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu"><X className="size-4" /></button>
      </div>
      <div className="px-3 pt-3">
        <div className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-line bg-ivory">
          <span className="size-8 rounded-lg grid place-items-center text-white text-xs font-semibold shrink-0" style={{ background: tenant.primaryColor }}>{tenant.name.split(' ').pop()![0]}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium truncate">{tenant.name}</span>
            <span className="block text-[11px] text-muted">Espace {tenant.status === 'essai' ? 'en essai' : 'actif'} · plan {tenant.plan}</span>
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-5">
        {NAV.map((g) => {
          const items = g.items.filter((i) => !i.perm || can(i.perm))
          if (!items.length) return null
          return (
            <div key={g.group}>
              <div className="px-2.5 mb-1 text-[10px] uppercase tracking-[0.14em] text-soft font-medium">{g.group}</div>
              {items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.to === '/admin'} className={({ isActive }) => cx('flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] transition', isActive ? 'bg-sage-600 text-white shadow-soft' : 'text-muted hover:text-ink hover:bg-cream')}>
                  <i.icon className="size-4" strokeWidth={1.75} /> {i.label}
                </NavLink>
              ))}
            </div>
          )
        })}
      </div>
      <div className="p-3 border-t border-line">
        <Link to={`/boutique?boutique=${tenant.slug}`} target="_blank" className="flex items-center gap-2 px-2.5 h-9 rounded-lg text-[13px] text-muted hover:bg-cream hover:text-ink">
          <ExternalLink className="size-4" /> Voir la boutique en ligne
        </Link>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen bg-ivory">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-white border-r border-line z-30">{sidebar}</aside>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink/25" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-lift animate-fade-up">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 h-16 bg-ivory/85 backdrop-blur border-b border-line flex items-center gap-3 px-4 md:px-8">
          <button className="lg:hidden btn-ghost h-9 w-9 p-0" onClick={() => setMobileOpen(true)} aria-label="Menu"><Menu className="size-5" /></button>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-soft" />
            <input className="input pl-9 bg-white" placeholder="Rechercher produit, client, commande…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setQ('')} />
            {results.length > 0 && (
              <div className="absolute mt-2 w-full card shadow-lift p-1.5 z-40">
                {results.map((r) => (
                  <button key={r.to} onClick={() => { nav(r.to); setQ('') }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-cream cursor-pointer">
                    <div className="text-sm">{r.label}</div>
                    <div className="text-[11px] text-muted">{r.sub}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <select className="input h-9 w-auto hidden md:block" value={session.scope} onChange={(e) => actions.setSession({ scope: e.target.value })} aria-label="Boutique">
              <option value="all">Toutes les boutiques</option>
              {d.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Link to="/admin/messages" className="relative btn-ghost h-9 w-9 p-0" aria-label="Messages clients">
              <MessageCircle className="size-[18px]" />
              {openChats > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-champagne-400" />}
            </Link>
            <Dropdown width="w-80" trigger={() => (
              <button className="relative btn-ghost h-9 w-9 p-0" aria-label="Notifications">
                <Bell className="size-[18px]" />
                {unread > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-rose-ink text-white text-[10px] grid place-items-center">{unread}</span>}
              </button>
            )}>
              {(close) => (
                <div>
                  <div className="flex items-center justify-between px-2.5 py-2">
                    <span className="text-sm font-semibold">Notifications</span>
                    <button className="text-xs text-sage-600 hover:underline cursor-pointer" onClick={() => actions.markAllRead()}>Tout marquer lu</button>
                  </div>
                  <div className="max-h-96 overflow-y-auto scrollbar-thin">
                    {d.notifications.slice(0, 12).map((n) => (
                      <button key={n.id} onClick={() => { close(); n.link && nav(n.link) }} className="w-full text-left flex gap-2.5 px-2.5 py-2 rounded-lg hover:bg-cream cursor-pointer">
                        <span className={cx('mt-1.5 size-2 rounded-full shrink-0', n.read ? 'bg-sand' : 'bg-sage-500')} />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium">{n.title}</span>
                          <span className="block text-xs text-muted truncate">{n.body}</span>
                          <span className="block text-[11px] text-soft mt-0.5">{relative(n.date)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Dropdown>
            <Dropdown width="w-64" trigger={() => (
              <button className="flex items-center gap-2 pl-1.5 pr-2 h-9 rounded-xl hover:bg-cream cursor-pointer">
                <Avatar name={session.userName} />
                <span className="hidden md:block text-left leading-tight">
                  <span className="block text-[13px] font-medium">{session.userName}</span>
                  <span className="block text-[11px] text-muted">{ROLE_LABEL[session.role]}</span>
                </span>
              </button>
            )}>
              {(close) => (
                <div className="p-1">
                  <div className="px-2.5 pt-1 pb-2">
                    <div className="text-sm font-medium">{session.userName}</div>
                    <div className="text-[11px] text-muted">{ROLE_LABEL[session.role]} · {tenant.name}</div>
                  </div>
                  <div className="border-t border-line my-1" />
                  <Link to="/" onClick={close} className="block px-2.5 py-2 rounded-lg text-sm text-muted hover:bg-cream">Site Paraflow</Link>
                  <button onClick={() => { close(); actions.logout(); nav('/connexion') }} className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-rose-ink hover:bg-cream cursor-pointer"><LogOut className="size-4" /> Se déconnecter</button>
                </div>
              )}
            </Dropdown>
          </div>
        </header>
        <main className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto animate-fade-up" key={loc.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
