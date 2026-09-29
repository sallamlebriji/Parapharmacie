import { createContext, useContext, useSyncExternalStore } from 'react'
import { api, ApiError } from './api'
import { customerStats, type CartLine } from './logic'
import { toast } from '../components/ui'
import { uid } from './format'
import type {
  Campaign, ChatThread, Customer, DeliveryZone, Employee, Movement, Order, OrderStatus, Pack, Permission, PlanId, Product, Promotion,
  PurchaseOrder, Role, Store, Tenant, TenantData, Wishlist,
} from './types'

/*
 * Client state backed by the Express + MySQL API.
 * - Back-office: the signed-in employee's tenant snapshot (GET /bootstrap), kept fresh by polling
 *   GET /sync and by merging the rows returned by every mutation.
 * - Storefront: a public snapshot of one tenant (GET /store/:slug/bootstrap) plus the local cart.
 * Pages keep the same hooks and action names as the offline prototype.
 */

export interface ShopState { cart: CartLine[]; coupon: string; customerId: string | null; wishlists: Wishlist[]; recentlyViewed: string[] }
export interface Session { tenantId: string; scope: string; role: Role; userName: string; userId: string; storeId: string | null }
export interface StaffUser { id: string; name: string; email: string; role: Role; storeId: string | null }

export interface AppState {
  token: string | null
  operatorToken: string | null
  tenant: Tenant | null
  data: TenantData | null
  session: Session
  lastSync: string | null
  shopSlug: string
  shopToken: string | null
  shopTenant: Tenant | null
  shopData: TenantData | null
  shop: ShopState
  guestKeys: Record<string, string>
  chatKeys: Record<string, string>
}

const KEY = 'paraflow:client:v1'
const defaultWishlist = (): Wishlist[] => [{ id: uid('wl'), name: 'Mes favoris', productIds: [], alerts: { stock: true, price: true } }]
const emptySession: Session = { tenantId: '', scope: 'all', role: 'admin', userName: '', userId: '', storeId: null }

function load(): AppState {
  const base: AppState = {
    token: null, operatorToken: null, tenant: null, data: null, session: emptySession, lastSync: null,
    shopSlug: 'seve', shopToken: null, shopTenant: null, shopData: null,
    shop: { cart: [], coupon: '', customerId: null, wishlists: defaultWishlist(), recentlyViewed: [] }, guestKeys: {}, chatKeys: {},
  }
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (saved) return { ...base, ...saved, data: null, tenant: null, shopData: null, shopTenant: null, lastSync: null }
  } catch { /* storage unavailable */ }
  return base
}

let state: AppState = load()
const listeners = new Set<() => void>()
let saveTimer: number | undefined

function set(p: Partial<AppState>) {
  state = { ...state, ...p }
  listeners.forEach((l) => l())
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    const { token, operatorToken, session, shopSlug, shopToken, shop, guestKeys, chatKeys } = state
    try { localStorage.setItem(KEY, JSON.stringify({ token, operatorToken, session, shopSlug, shopToken, shop, guestKeys, chatKeys })) } catch { /* ignore */ }
  }, 200)
}

export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => selector(state))
}
export const getState = () => state

/* ─────────────── merging server changes ─────────────── */

type Changes = Partial<Record<keyof TenantData, { id?: string }[]>>
type Removed = Partial<Record<keyof TenantData, string[]>>

function upsert<X extends { id?: string }>(list: X[], rows: X[]) {
  const out = [...list]
  for (const r of rows) {
    const i = out.findIndex((x) => x.id === r.id)
    if (i >= 0) out[i] = r
    else out.unshift(r)
  }
  return out
}

function applyTo(d: TenantData, changes: Changes = {}, removed: Removed = {}): TenantData {
  const next = { ...d } as Record<string, unknown>
  for (const [k, rows] of Object.entries(changes)) if (Array.isArray(rows) && rows.length) next[k] = upsert((next[k] as { id?: string }[]) ?? [], rows)
  for (const [k, ids] of Object.entries(removed)) if (ids?.length) next[k] = ((next[k] as { id?: string }[]) ?? []).filter((x) => !ids.includes(x.id!))
  return next as unknown as TenantData
}
const apply = (changes?: Changes, removed?: Removed) => { if (state.data) set({ data: applyTo(state.data, changes, removed) }) }

/* ─────────────── API helpers ─────────────── */

async function staff<T = { changes: Changes }>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown, quiet = false): Promise<T> {
  try {
    const r = await api<T>(method, path, body, state.token)
    const c = r as unknown as { changes?: Changes; removed?: Removed }
    if (c && typeof c === 'object' && ('changes' in c || 'removed' in c)) apply(c.changes, c.removed)
    return r
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && state.token) set({ token: null, data: null, tenant: null })
    if (!quiet) toast(e instanceof Error ? e.message : 'Erreur', 'error')
    throw e
  }
}

const shopPath = (p: string) => `/store/${encodeURIComponent(state.shopSlug)}${p}`
async function shopApi<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown, quiet = false): Promise<T> {
  try { return await api<T>(method, shopPath(path), body, state.shopToken) } catch (e) {
    if (e instanceof ApiError && e.status === 401 && state.shopToken && path !== '/auth/login') set({ shopToken: null, shop: { ...state.shop, customerId: null } })
    if (!quiet) toast(e instanceof Error ? e.message : 'Erreur', 'error')
    throw e
  }
}
const updateShopData = (fn: (d: TenantData) => Partial<TenantData>) => { if (state.shopData) set({ shopData: { ...state.shopData, ...fn(state.shopData) } }) }
const setShop = (p: Partial<ShopState>) => set({ shop: { ...state.shop, ...p } })

let wishTimer: number | undefined
function syncWishlists() {
  if (!state.shopToken) return
  clearTimeout(wishTimer)
  wishTimer = window.setTimeout(() => { shopApi<Wishlist[]>('PUT', '/me/wishlists', state.shop.wishlists, true).catch(() => {}) }, 600)
}

let tenantTimer: number | undefined

/* ─────────────── actions ─────────────── */

export const actions = {
  /* authentication & session */
  async login(email: string, password: string): Promise<'staff' | 'operator'> {
    const r = await api<{ kind: 'staff' | 'operator'; token: string; user: StaffUser; tenant?: Tenant }>('POST', '/auth/login', { email, password })
    if (r.kind === 'operator') { set({ operatorToken: r.token }); return 'operator' }
    set({ token: r.token, tenant: r.tenant ?? null, data: null, session: { ...emptySession, tenantId: r.tenant!.id, role: r.user.role, userName: r.user.name, userId: r.user.id, storeId: r.user.storeId } })
    await actions.loadBootstrap()
    return 'staff'
  },
  async signup(input: { pharmacyName: string; city: string; plan: PlanId; ownerName: string; email: string; password: string }) {
    const r = await api<{ token: string; user: StaffUser; tenant: Tenant }>('POST', '/auth/signup', input)
    set({ token: r.token, tenant: r.tenant, data: null, session: { ...emptySession, tenantId: r.tenant.id, role: 'admin', userName: r.user.name, userId: r.user.id, storeId: r.user.storeId } })
    await actions.loadBootstrap()
  },
  logout() { set({ token: null, data: null, tenant: null, session: emptySession, lastSync: null }) },
  logoutOperator() { set({ operatorToken: null }) },
  async loadBootstrap() {
    const r = await staff<{ serverTime: string; tenant: Tenant; user: StaffUser; data: TenantData }>('GET', '/bootstrap', undefined, true)
    set({ data: r.data, tenant: r.tenant, lastSync: r.serverTime, session: { ...state.session, tenantId: r.tenant.id, role: r.user.role, userName: r.user.name, userId: r.user.id, storeId: r.user.storeId, scope: state.session.scope || 'all' } })
  },
  /** Pulls rows changed by other devices (POS, web orders, colleagues) since the last sync. */
  async sync() {
    if (!state.token || !state.data || !state.lastSync) return
    const r = await staff<{ serverTime: string; changes: Changes }>('GET', `/sync?since=${encodeURIComponent(state.lastSync)}`, undefined, true)
    set({ lastSync: r.serverTime })
  },
  setSession(p: Partial<Session>) { set({ session: { ...state.session, ...p } }) },

  /* tenant (debounced: settings forms save as you type) */
  updateTenant(p: Partial<Omit<Tenant, 'settings'>> & { settings?: Partial<Tenant['settings']> }) {
    if (!state.tenant) return
    set({ tenant: { ...state.tenant, ...p, settings: { ...state.tenant.settings, ...(p.settings ?? {}) } } })
    clearTimeout(tenantTimer)
    tenantTimer = window.setTimeout(async () => {
      const { name, tagline, primaryColor, settings } = state.tenant!
      const r = await staff<{ tenant: Tenant }>('PUT', '/tenant', { name, tagline, primaryColor, settings: { pointsPerDh: settings.pointsPerDh, pointValue: settings.pointValue, vatRate: settings.vatRate, lowStockDefault: settings.lowStockDefault } })
      set({ tenant: r.tenant })
    }, 500)
  },
  async changePlan(plan: PlanId) { const r = await staff<{ tenant: Tenant }>('PUT', '/tenant/plan', { plan }); set({ tenant: r.tenant }) },

  /* catalogue */
  async saveProduct(p: Product): Promise<string> {
    const body = { ...p, promoPrice: p.promoPrice ?? null }
    if (state.data?.products.some((x) => x.id === p.id)) { await staff('PUT', `/products/${p.id}`, body); return p.id }
    const r = await staff<{ changes: Changes; result: { id: string } }>('POST', '/products', body)
    return r.result.id
  },

  /* stock */
  async addLot(input: { productId: string; storeId: string; number: string; qty: number; expiresAt: string; supplierId?: string; note?: string }) { await staff('POST', '/stock/lots', input) },
  async adjustStock(productId: string, storeId: string, delta: number, note: string, type: Movement['type'] = 'ajustement') {
    await staff('POST', '/stock/adjust', { productId, storeId, delta, note, type: type === 'sortie' ? 'sortie' : 'ajustement' })
  },
  async inventoryCount(productId: string, storeId: string, counted: number) { await staff('POST', '/stock/inventory', { productId, storeId, counted }) },
  async transferStock(productId: string, from: string, to: string, qty: number) { await staff('POST', '/stock/transfer', { productId, from, to, qty }) },
  async importStock(rows: { ref: string; store: string; qty: number; lot?: string; expiry?: string }[]) {
    const r = await staff<{ changes: Changes; result: { applied: number; errors: string[] } }>('POST', '/stock/import', { rows: rows.filter((x) => x.ref && !Number.isNaN(x.qty)) })
    if (r.result.errors.length) toast(r.result.errors.slice(0, 3).join(' · '), 'error')
    return r.result.applied
  },

  /* orders & POS */
  async advanceOrder(orderId: string, to?: OrderStatus) { await staff('POST', `/orders/${orderId}/advance`, to ? { to } : {}) },
  async cancelOrder(orderId: string) { await staff('POST', `/orders/${orderId}/cancel`) },
  async markPaid(orderId: string) { await staff('POST', `/orders/${orderId}/mark-paid`) },
  async posSale(input: { storeId: string; lines: { productId: string; qty: number }[]; discount: number; method: 'carte' | 'especes'; customerId?: string; pointsUsed?: number }) {
    const r = await staff<{ changes: Changes; result: Order }>('POST', '/pos/sales', input)
    return r.result
  },
  async posReturn(orderId: string, items: { productId: string; qty: number }[], mode: 'remboursement' | 'avoir') { await staff('POST', '/pos/returns', { orderId, items, mode }) },

  /* purchasing */
  async savePO(po: PurchaseOrder) {
    const existing = state.data?.purchaseOrders.find((x) => x.id === po.id)
    const body = { supplierId: po.supplierId, storeId: po.storeId, expectedAt: po.expectedAt, lines: po.lines.map((l) => ({ productId: l.productId, qty: l.qty, unitCost: l.unitCost })), status: po.status === 'envoyee' ? 'envoyee' : 'brouillon' }
    if (!existing) { await staff('POST', '/purchase-orders', body); return }
    if (existing.status === 'brouillon' && po.status === 'envoyee' && po.lines === existing.lines) { await staff('POST', `/purchase-orders/${po.id}/send`); return }
    await staff('PUT', `/purchase-orders/${po.id}`, body)
  },
  async receivePO(poId: string, receipts: { index: number; qty: number; lotNumber: string; expiresAt: string }[]) { await staff('POST', `/purchase-orders/${poId}/receive`, { receipts }) },
  async payInvoice(poId: string) { await staff('POST', `/purchase-orders/${poId}/pay`) },

  /* CRM */
  async saveCustomer(c: Customer) {
    const body = { firstName: c.firstName, lastName: c.lastName, phone: c.phone, email: c.email, address: c.address, city: c.city, skinType: c.skinType, marketingOptIn: c.marketingOptIn }
    if (state.data?.customers.some((x) => x.id === c.id)) await staff('PUT', `/customers/${c.id}`, body)
    else await staff('POST', '/customers', body)
  },
  async adjustPoints(customerId: string, delta: number) { await staff('POST', `/customers/${customerId}/points`, { delta }) },

  /* commerce & marketing */
  async savePromotion(p: Promotion) {
    const body = { name: p.name, code: p.code || undefined, type: p.type, value: p.value, target: p.target || undefined, buyX: p.buyX, getY: p.getY, minAmount: p.minAmount, startsAt: p.startsAt, endsAt: p.endsAt, active: p.active, highlight: !!p.highlight }
    if (state.data?.promotions.some((x) => x.id === p.id)) await staff('PUT', `/promotions/${p.id}`, body)
    else await staff('POST', '/promotions', body)
  },
  async savePack(p: Pack) {
    const body = { slug: p.slug, name: p.name, kind: p.kind, tagline: p.tagline, description: p.description, productIds: p.productIds, price: p.price, steps: p.steps }
    if (state.data?.packs.some((x) => x.id === p.id)) await staff('PUT', `/packs/${p.id}`, body)
    else await staff('POST', '/packs', body)
  },
  async saveCampaign(c: Campaign) {
    const body = { name: c.name, channel: c.channel, segment: c.segment, subject: c.subject, date: c.date, status: c.status === 'programmee' ? 'programmee' : 'brouillon' }
    const exists = state.data?.campaigns.some((x) => x.id === c.id)
    const r = exists ? await staff('PUT', `/campaigns/${c.id}`, body) : await staff('POST', '/campaigns', body)
    const saved = (r.changes.campaigns?.[0] as Campaign | undefined)?.id ?? c.id
    if (c.status === 'envoyee') return actions.sendCampaign(saved)
    return null
  },
  async sendCampaign(id: string) {
    const r = await staff<{ changes: Changes; result: { audience: number } }>('POST', `/campaigns/${id}/send`)
    return r.result.audience
  },
  async moderateReview(id: string, publish: boolean) { await staff('POST', `/reviews/${id}/moderate`, { publish }) },

  /* organisation */
  async saveEmployee(e: Employee): Promise<string | null> {
    const body = { name: e.name, email: e.email, role: e.role, storeId: e.storeId, active: e.active }
    if (state.data?.employees.some((x) => x.id === e.id)) { await staff('PUT', `/employees/${e.id}`, body); return null }
    const r = await staff<{ changes: Changes; result: { temporaryPassword: string } }>('POST', '/employees', body)
    return r.result.temporaryPassword
  },
  async togglePermission(role: Role, perm: Permission) {
    if (role === 'admin' || !state.data) return
    const enabled = !state.data.permissions[role].includes(perm)
    const r = await staff<{ result: { permissions: Record<Role, Permission[]> } }>('PUT', '/permissions', { role, permission: perm, enabled })
    set({ data: { ...state.data!, permissions: r.result.permissions } })
  },
  async saveStore(s: Store) {
    const body = { name: s.name, city: s.city, address: s.address, phone: s.phone, manager: s.manager, openedAt: s.openedAt }
    if (state.data?.stores.some((x) => x.id === s.id)) await staff('PUT', `/stores/${s.id}`, body)
    else await staff('POST', '/stores', body)
  },
  async saveZone(z: DeliveryZone) {
    const { id, ...body } = z
    if (state.data?.zones.some((x) => x.id === id)) await staff('PUT', `/zones/${id}`, body)
    else await staff('POST', '/zones', body)
  },
  async addExpense(label: string, category: string, amount: number, storeId: string) { await staff('POST', '/expenses', { label, category, amount, storeId }) },

  /* notifications & messages (back-office side) */
  async markAllRead() { await staff('POST', '/notifications/read-all') },
  async sendChat(threadId: string, text: string) { await staff('POST', `/chats/${threadId}/messages`, { text }) },
  async resolveChat(id: string) { await staff('POST', `/chats/${id}/resolve`) },

  /* ───────── storefront ───────── */
  async loadShop(slug?: string) {
    if (slug && slug !== state.shopSlug) set({ shopSlug: slug, shopToken: null, shopData: null, shopTenant: null, shop: { cart: [], coupon: '', customerId: null, wishlists: defaultWishlist(), recentlyViewed: [] } })
    const r = await shopApi<{ tenant: Tenant; data: TenantData; customerId: string | null; wishlists: Wishlist[] | null }>('GET', '/bootstrap', undefined, true)
    set({ shopTenant: r.tenant, shopData: r.data })
    setShop({ customerId: r.customerId, wishlists: r.wishlists?.length ? r.wishlists : state.shop.wishlists })
  },
  async shopLogin(email: string, password: string) {
    const r = await shopApi<{ token: string }>('POST', '/auth/login', { email, password })
    const local = state.shop.wishlists
    set({ shopToken: r.token })
    await actions.loadShop()
    // Favourites collected as a guest are merged into the account.
    if (local.some((w) => w.productIds.length)) { setShop({ wishlists: mergeWishlists(state.shop.wishlists, local) }); syncWishlists() }
  },
  async shopRegister(input: { firstName: string; lastName: string; email: string; phone: string; password: string; marketingOptIn: boolean }) {
    const r = await shopApi<{ token: string }>('POST', '/auth/register', input)
    set({ shopToken: r.token })
    await actions.loadShop()
    syncWishlists()
  },
  async shopLogout() {
    set({ shopToken: null, shop: { ...state.shop, customerId: null, wishlists: defaultWishlist() } })
    await actions.loadShop()
  },
  /** Kept for compatibility with pages: null signs the customer out. */
  setShopCustomer(customerId: string | null) { if (!customerId) void actions.shopLogout() },

  addToCart(line: CartLine) {
    const key = (l: CartLine) => (l.kind === 'pack' ? 'k' + l.packId : 'p' + l.productId)
    const cart = state.shop.cart
    const found = cart.find((l) => key(l) === key(line))
    setShop({ cart: found ? cart.map((l) => (key(l) === key(line) ? { ...l, qty: l.qty + line.qty } : l)) : [...cart, line] })
  },
  setCartQty(index: number, qty: number) { setShop({ cart: qty <= 0 ? state.shop.cart.filter((_, i) => i !== index) : state.shop.cart.map((l, i) => (i === index ? { ...l, qty } : l)) }) },
  /** Coupon codes are validated by the server; a valid one is added to the local pricing data. */
  async setCoupon(code: string) {
    const c = code.trim().toUpperCase()
    setShop({ coupon: c })
    if (!c) return
    try {
      const promo = await shopApi<Promotion>('GET', `/coupons/${encodeURIComponent(c)}`, undefined, true)
      updateShopData((d) => ({ promotions: upsert(d.promotions, [promo]) }))
    } catch { /* computeCart reports the invalid code */ }
  },
  viewProduct(id: string) { setShop({ recentlyViewed: [id, ...state.shop.recentlyViewed.filter((x) => x !== id)].slice(0, 10) }) },
  toggleWish(productId: string, listId?: string) {
    const s = state.shop
    const target = listId ?? s.wishlists[0].id
    const inAny = s.wishlists.some((w) => w.productIds.includes(productId))
    const wishlists = !listId && inAny
      ? s.wishlists.map((w) => ({ ...w, productIds: w.productIds.filter((p) => p !== productId) }))
      : s.wishlists.map((w) => (w.id === target ? { ...w, productIds: w.productIds.includes(productId) ? w.productIds.filter((p) => p !== productId) : [...w.productIds, productId] } : w))
    setShop({ wishlists }); syncWishlists()
  },
  createWishlist(name: string) { setShop({ wishlists: [...state.shop.wishlists, { id: uid('wl'), name, productIds: [], alerts: { stock: true, price: true } }] }); syncWishlists() },
  toggleWishAlert(listId: string, key: 'stock' | 'price') {
    setShop({ wishlists: state.shop.wishlists.map((w) => (w.id === listId ? { ...w, alerts: { ...w.alerts, [key]: !w.alerts[key] } } : w)) }); syncWishlists()
  },

  async placeWebOrder(input: { lines: CartLine[]; customer: { firstName: string; lastName: string; email: string; phone: string; address: string; city: string }; coupon?: string; mode: 'standard' | 'express' | 'retrait'; method: 'carte' | 'livraison'; usePoints: boolean }) {
    const r = await shopApi<{ order: Order; customer: Customer; token: string; guestKey: string }>('POST', '/orders', input)
    set({ shopToken: r.token, guestKeys: { ...state.guestKeys, [r.order.id]: r.guestKey } })
    setShop({ cart: [], coupon: '', customerId: r.customer.id })
    updateShopData((d) => ({ orders: upsert(d.orders, [r.order]), customers: upsert(d.customers, [r.customer]) }))
    void actions.loadShop()
    return r.order.id
  },
  async fetchShopOrder(id: string) {
    const key = state.guestKeys[id]
    const r = await shopApi<{ order: Order }>('GET', `/orders/${id}${key ? `?key=${key}` : ''}`, undefined, true)
    updateShopData((d) => ({ orders: upsert(d.orders, [r.order]) }))
  },
  async addReview(r: { productId: string; author: string; rating: number; title: string; text: string; hasPhoto?: boolean }) { await shopApi('POST', '/reviews', r) },
  async redeemReward(_customerId: string, cost: number): Promise<string> {
    const r = await shopApi<{ code: string; customer: Customer }>('POST', '/me/redeem', { cost })
    updateShopData((d) => ({ customers: upsert(d.customers, [r.customer]) }))
    return r.code
  },

  /* customer chat */
  async shopChatStart(text: string, meta: { name: string; topic: ChatThread['topic']; history: { from: 'client' | 'bot'; text: string }[] }) {
    const r = await shopApi<{ thread: ChatThread; key: string }>('POST', '/chats', { text, ...meta })
    set({ chatKeys: { ...state.chatKeys, [r.thread.id]: r.key } })
    updateShopData((d) => ({ chats: upsert(d.chats, [r.thread]) }))
    return r.thread.id
  },
  async shopChatSend(threadId: string, text: string) {
    const t = await shopApi<ChatThread>('POST', `/chats/${threadId}/messages?key=${state.chatKeys[threadId] ?? ''}`, { text })
    updateShopData((d) => ({ chats: upsert(d.chats, [t]) }))
  },
  async shopChatRefresh(threadId: string) {
    const t = await shopApi<ChatThread>('GET', `/chats/${threadId}?key=${state.chatKeys[threadId] ?? ''}`, undefined, true)
    updateShopData((d) => ({ chats: upsert(d.chats, [t]) }))
  },
}

function mergeWishlists(server: Wishlist[], local: Wishlist[]) {
  if (!server.length) return local.map((w) => ({ ...w }))
  const out = server.map((w) => ({ ...w, productIds: [...w.productIds] }))
  local.forEach((l) => l.productIds.forEach((id) => { if (!out[0].productIds.includes(id)) out[0].productIds.push(id) }))
  return out
}

/* ─────────────── hooks ─────────────── */

/** True inside the storefront layout: data hooks then read the public shop snapshot. */
export const ShopScope = createContext(false)

export const useTenant = () => { const shop = useContext(ShopScope); return useApp((s) => (shop ? s.shopTenant : s.tenant)!) }
export const useData = () => { const shop = useContext(ShopScope); return useApp((s) => (shop ? s.shopData : s.data)!) }
export const useSession = () => useApp((s) => s.session)
export const useShop = () => useApp((s) => s.shop)

export function useCan() {
  const role = useApp((s) => s.session.role)
  const perms = useApp((s) => s.data?.permissions[role])
  return (p: Permission) => !!perms?.includes(p)
}

export function useShopCustomer() {
  const d = useApp((s) => s.shopData)
  const id = useApp((s) => s.shop.customerId)
  const c = d?.customers.find((x) => x.id === id)
  return c && d ? { customer: c, stats: customerStats(d, c) } : null
}
