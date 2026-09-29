import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3, Bell, Boxes, Building2, CalendarClock, CircleDollarSign, ClipboardList, ExternalLink, Gift, LayoutDashboard, LogOut,
  Megaphone, Menu, MessageCircle, Monitor, Moon, Package, Percent, Plus, Receipt, Search, Settings, ShoppingBag, Store, Sun, SunMoon,
  Truck, UserCog, Users, Warehouse,
} from 'lucide-react'
import { actions, useApp, useCan, useSession } from '../lib/store'
import { relative } from '../lib/format'
import { useTheme, type ThemePref } from '../lib/theme'
import { EASE } from '../lib/motion'
import { Avatar, Drawer, Skeleton, cx } from '../components/ui'
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
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.25, ease: EASE }}
            className={cx('absolute z-[var(--z-dropdown)] mt-2 card shadow-float p-1.5 origin-top', width, align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left')}
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Skeleton matching the real shell, shown while the tenant snapshot loads. */
function ShellSkeleton() {
  return (
    <div className="min-h-screen bg-ivory" aria-busy="true" aria-label="Chargement de votre espace">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-surface border-r border-line flex-col p-4 gap-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-full mt-2" />
        {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </aside>
      <div className="lg:pl-64">
        <div className="h-16 border-b border-line px-8 flex items-center"><Skeleton className="h-9 w-80" /></div>
        <div className="px-4 md:px-8 py-8 max-w-[1400px] mx-auto space-y-6">
          <Skeleton className="h-9 w-72" />
          <div className="grid lg:grid-cols-3 gap-4"><Skeleton className="h-72 lg:col-span-2 rounded-[var(--radius-card)]" /><Skeleton className="h-72 rounded-[var(--radius-card)]" /></div>
          <div className="grid lg:grid-cols-2 gap-4"><Skeleton className="h-56 rounded-[var(--radius-card)]" /><Skeleton className="h-56 rounded-[var(--radius-card)]" /></div>
        </div>
      </div>
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
  if (error) return (
    <div className="min-h-screen grid place-items-center bg-ivory text-sm px-6">
      <div className="card p-8 text-center max-w-sm">
        <p className="font-display text-xl">Connexion au serveur impossible</p>
        <p className="text-muted mt-2">{error}</p>
        <button className="btn-primary mt-5" onClick={() => { setError(''); actions.loadBootstrap().catch((e) => setError(e.message)) }}>Réessayer</button>
      </div>
    </div>
  )
  if (!ready) return <ShellSkeleton />
  return <AdminShell />
}

const THEMES: { id: ThemePref; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Clair', icon: Sun }, { id: 'dark', label: 'Sombre', icon: Moon }, { id: 'system', label: 'Système', icon: SunMoon },
]

function ThemeSwitch() {
  const { pref, setTheme } = useTheme()
  return (
    <div role="radiogroup" aria-label="Thème" className="flex p-0.5 rounded-lg bg-cream border border-line">
      {THEMES.map((t) => (
        <button key={t.id} role="radio" aria-checked={pref === t.id} title={t.label} onClick={() => setTheme(t.id)} className={cx('relative flex-1 h-7 grid place-items-center rounded-md cursor-pointer transition-colors', pref === t.id ? 'text-ink' : 'text-soft hover:text-ink')}>
          {pref === t.id && <motion.span layoutId="theme-pill" className="absolute inset-0 rounded-md bg-surface shadow-soft" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          <t.icon className="relative size-3.5" aria-hidden /><span className="sr-only">{t.label}</span>
        </button>
      ))}
    </div>
  )
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
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => setMobileOpen(false), [loc.pathname])

  // Ctrl/⌘+K or « / » focuses the global search.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement).tagName)
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  const unread = d.notifications.filter((n) => !n.read).length
  const openChats = d.chats.filter((c) => c.status === 'ouvert').length
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    const prods = d.products.filter((p) => `${p.name} ${p.brand} ${p.ref} ${p.barcode}`.toLowerCase().includes(s)).slice(0, 5).map((p) => ({ kind: 'Produit', label: p.name, sub: `${p.brand} · ${p.ref}`, to: `/admin/produits/${p.id}` }))
    const custs = d.customers.filter((c) => `${c.firstName} ${c.lastName} ${c.phone} ${c.email}`.toLowerCase().includes(s)).slice(0, 4).map((c) => ({ kind: 'Client', label: `${c.firstName} ${c.lastName}`, sub: c.phone, to: `/admin/clients/${c.id}` }))
    const ords = d.orders.filter((o) => o.number.toLowerCase().includes(s)).slice(0, 4).map((o) => ({ kind: 'Commande', label: o.number, sub: `${o.total} DH`, to: `/admin/commandes/${o.id}` }))
    return [...prods, ...custs, ...ords]
  }, [q, d])

  const quick = [
    can('pos.use') && { to: '/admin/pos', label: 'Nouvelle vente', icon: Monitor },
    can('produits.edit') && { to: '/admin/produits/nouveau', label: 'Nouveau produit', icon: Package },
    can('stock.manage') && { to: '/admin/stock', label: 'Mouvement de stock', icon: Boxes },
    can('achats.manage') && { to: '/admin/achats', label: 'Bon de commande', icon: ShoppingBag },
  ].filter(Boolean) as { to: string; label: string; icon: typeof Monitor }[]

  const isActive = (to: string) => (to === '/admin' ? loc.pathname === '/admin' : loc.pathname.startsWith(to))

  const sidebar = (layoutKey: string) => (
    <nav className="flex flex-col h-full" aria-label="Navigation principale">
      <div className="px-5 h-16 flex items-center border-b border-line">
        <Link to="/admin" aria-label="Tableau de bord"><Logo /></Link>
      </div>
      <div className="px-3 pt-3">
        <div className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-line bg-ivory/70">
          <span className="size-8 rounded-lg grid place-items-center text-white text-xs font-semibold shrink-0 shadow-soft" style={{ background: tenant.primaryColor }}>{tenant.name.split(' ').pop()![0]}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium truncate">{tenant.name}</span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className={cx('size-1.5 rounded-full', tenant.status === 'essai' ? 'bg-amber-ink' : 'bg-sage-500')} />
              {tenant.status === 'essai' ? 'Essai' : 'Actif'} · plan {tenant.plan}
            </span>
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-5">
        {NAV.map((g) => {
          const items = g.items.filter((i) => !i.perm || can(i.perm))
          if (!items.length) return null
          return (
            <div key={g.group}>
              <div className="px-2.5 mb-1.5 text-[10px] uppercase tracking-[0.16em] text-soft font-semibold">{g.group}</div>
              {items.map((i) => {
                const active = isActive(i.to)
                return (
                  <NavLink key={i.to} to={i.to} end={i.to === '/admin'} className={cx('relative flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] transition-colors', active ? 'text-sage-700 font-medium' : 'text-muted hover:text-ink hover:bg-cream/80')}>
                    {active && (
                      <motion.span layoutId={`nav-${layoutKey}`} className="absolute inset-0 rounded-lg bg-sage-50 border border-sage-100" transition={{ type: 'spring', stiffness: 460, damping: 38 }}>
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-accent" />
                      </motion.span>
                    )}
                    <i.icon className="relative size-4" strokeWidth={1.75} aria-hidden /> <span className="relative">{i.label}</span>
                  </NavLink>
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="p-3 border-t border-line space-y-2">
        <ThemeSwitch />
        <Link to={`/boutique?boutique=${tenant.slug}`} target="_blank" className="flex items-center gap-2 px-2.5 h-9 rounded-lg text-[13px] text-muted hover:bg-cream hover:text-ink">
          <ExternalLink className="size-4" aria-hidden /> Voir la boutique en ligne
        </Link>
      </div>
    </nav>
  )

  const mobileTabs = [
    { to: '/admin', label: 'Accueil', icon: LayoutDashboard, perm: 'dashboard.view' as Permission },
    { to: '/admin/commandes', label: 'Commandes', icon: ClipboardList, perm: 'commandes.manage' as Permission },
    { to: '/admin/pos', label: 'Caisse', icon: Monitor, perm: 'pos.use' as Permission },
    { to: '/admin/stock', label: 'Stock', icon: Boxes, perm: 'stock.manage' as Permission },
  ].filter((t) => can(t.perm))

  return (
    <div className="min-h-screen bg-ivory">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[var(--z-toast)] btn-primary">Aller au contenu</a>
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-surface border-r border-line z-[var(--z-sidebar)]">{sidebar('desktop')}</aside>
      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} side="left">{sidebar('mobile')}</Drawer>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-[var(--z-sticky)] h-16 glass border-b border-line flex items-center gap-3 px-4 md:px-8">
          <button className="lg:hidden btn-ghost h-9 w-9 p-0" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu"><Menu className="size-5" /></button>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-soft" aria-hidden />
            <input ref={searchRef} className="input pl-9 pr-14" placeholder="Rechercher produit, client, commande…" aria-label="Recherche globale" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); e.currentTarget.blur() } if (e.key === 'Enter' && results[0]) { nav(results[0].to); setQ('') } }} />
            <kbd className="hidden md:flex absolute right-2.5 top-1/2 -translate-y-1/2 h-5 items-center px-1.5 rounded-md border border-line bg-cream text-[10px] text-soft font-sans">Ctrl K</kbd>
            <AnimatePresence>
              {results.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22, ease: EASE }} className="absolute mt-2 w-full card shadow-float p-1.5 z-[var(--z-dropdown)]" role="listbox">
                  {results.map((r) => (
                    <button key={r.to} role="option" onClick={() => { nav(r.to); setQ('') }} className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-cream cursor-pointer">
                      <span className="text-[10px] uppercase tracking-wider text-soft w-16 shrink-0">{r.kind}</span>
                      <span className="min-w-0"><span className="block text-sm truncate">{r.label}</span><span className="block text-[11px] text-muted truncate">{r.sub}</span></span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <select className="input h-9 w-auto hidden md:block" value={session.scope} onChange={(e) => actions.setSession({ scope: e.target.value })} aria-label="Boutique affichée">
              <option value="all">Toutes les boutiques</option>
              {d.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {quick.length > 0 && (
              <Dropdown width="w-56" trigger={() => <button className="btn-primary h-9 px-3" aria-label="Actions rapides"><Plus className="size-4" /><span className="hidden xl:inline">Créer</span></button>}>
                {(close) => quick.map((a) => (
                  <Link key={a.label} to={a.to} onClick={close} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-cream"><a.icon className="size-4 text-sage-600" aria-hidden />{a.label}</Link>
                ))}
              </Dropdown>
            )}
            <Link to="/admin/messages" className="relative btn-ghost h-9 w-9 p-0" aria-label={`Messages clients${openChats ? ` (${openChats} ouverts)` : ''}`}>
              <MessageCircle className="size-[18px]" />
              {openChats > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-champagne-400"><span className="absolute inset-0 rounded-full bg-champagne-400 animate-ring" /></span>}
            </Link>
            <Dropdown width="w-80" trigger={() => (
              <button className="relative btn-ghost h-9 w-9 p-0" aria-label={`Notifications${unread ? ` (${unread} non lues)` : ''}`}>
                <Bell className="size-[18px]" />
                {unread > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-rose-ink text-white text-[10px] grid place-items-center num">{unread}</span>}
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
                      <button key={n.id} onClick={() => { close(); if (n.link) nav(n.link) }} className="w-full text-left flex gap-2.5 px-2.5 py-2 rounded-lg hover:bg-cream cursor-pointer">
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
              <button className="flex items-center gap-2 pl-1.5 pr-2 h-9 rounded-xl hover:bg-cream cursor-pointer" aria-label="Profil">
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
                  <div className="px-2.5 pb-2 lg:hidden"><ThemeSwitch /></div>
                  <div className="border-t border-line my-1" />
                  <Link to="/" onClick={close} className="block px-2.5 py-2 rounded-lg text-sm text-muted hover:bg-cream">Site Paraflow</Link>
                  <button onClick={() => { close(); actions.logout(); nav('/connexion') }} className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-rose-ink hover:bg-cream cursor-pointer"><LogOut className="size-4" /> Se déconnecter</button>
                </div>
              )}
            </Dropdown>
          </div>
        </header>
        <main id="contenu" className="px-4 md:px-8 pt-6 md:pt-8 pb-24 lg:pb-10 max-w-[1400px] mx-auto page-stagger" key={loc.pathname}>
          <Outlet />
        </main>
      </div>

      {/* Mobile: the four most used modules stay one tap away. */}
      {mobileTabs.length > 1 && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-[var(--z-sidebar)] glass border-t border-line grid pb-[env(safe-area-inset-bottom)]" style={{ gridTemplateColumns: `repeat(${mobileTabs.length + 1}, 1fr)` }} aria-label="Navigation rapide">
          {mobileTabs.map((t) => (
            <Link key={t.to} to={t.to} className={cx('flex flex-col items-center justify-center gap-0.5 h-14 text-[10px] font-medium', isActive(t.to) ? 'text-sage-700' : 'text-soft')}>
              <t.icon className="size-5" aria-hidden />{t.label}
            </Link>
          ))}
          <button onClick={() => setMobileOpen(true)} className="flex flex-col items-center justify-center gap-0.5 h-14 text-[10px] font-medium text-soft cursor-pointer"><Menu className="size-5" aria-hidden />Menu</button>
        </nav>
      )}
    </div>
  )
}
