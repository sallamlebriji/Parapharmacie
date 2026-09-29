// Domain model. Every tenant-owned entity lives inside a TenantData bucket,
// mirroring the `tenant_id` column + row-level security of the real backend
// (see docs/ARCHITECTURE.md and docs/schema.prisma).

export type ID = string

export type CategoryId =
  | 'visage' | 'corps' | 'cheveux' | 'hygiene' | 'bebe' | 'solaire' | 'maquillage'
  | 'parfumerie' | 'complements' | 'bucco' | 'homme' | 'femme' | 'accessoires'

export type Shape = 'bottle' | 'tube' | 'jar' | 'pump' | 'dropper' | 'spray' | 'box' | 'stick'

export interface Product {
  id: ID
  name: string
  brand: string
  ref: string
  barcode: string
  category: CategoryId
  subcategory: string
  needs: string[]
  skinTypes: string[]
  description: string
  composition: string
  usage: string
  warnings: string
  purchasePrice: number
  price: number
  promoPrice?: number
  alertThreshold: number
  supplierId: ID
  shape: Shape
  color: string
  volume: string
  rating: number
  reviewsCount: number
  isNew?: boolean
  createdAt: string
  active: boolean
}

export interface Lot {
  id: ID
  productId: ID
  storeId: ID
  number: string
  qty: number
  initialQty: number
  receivedAt: string
  expiresAt: string
  supplierId: ID
}

export type MovementType = 'entree' | 'sortie' | 'ajustement' | 'transfert' | 'inventaire' | 'vente' | 'retour'

export interface Movement {
  id: ID
  date: string
  type: MovementType
  productId: ID
  lotId?: ID
  storeId: ID
  toStoreId?: ID
  qty: number
  note: string
  user: string
}

export type OrderStatus = 'recue' | 'preparation' | 'expediee' | 'livraison' | 'livree' | 'annulee'
export type PaymentStatus = 'en_attente' | 'paye' | 'rembourse'

export interface OrderItem { productId: ID; qty: number; unitPrice: number; unitCost: number }

export interface Order {
  id: ID
  number: string
  channel: 'web' | 'pos'
  storeId: ID
  customerId?: ID
  items: OrderItem[]
  subtotal: number
  discount: number
  shipping: number
  total: number
  couponCode?: string
  pointsUsed?: number
  status: OrderStatus
  payment: { method: 'carte' | 'especes' | 'livraison' | 'virement'; status: PaymentStatus }
  delivery?: { mode: 'standard' | 'express' | 'retrait'; zoneId: ID; address: string; city: string; carrier?: string; tracking?: string }
  history: { status: OrderStatus; date: string }[]
  createdAt: string
  cashier?: string
}

export interface Customer {
  id: ID
  firstName: string
  lastName: string
  phone: string
  email: string
  address: string
  city: string
  createdAt: string
  points: number
  couponsUsed: string[]
  favorites: ID[]
  skinType?: string
  marketingOptIn: boolean
}

export interface Supplier {
  id: ID
  name: string
  contact: string
  email: string
  phone: string
  city: string
  paymentTerms: string
  brands: string[]
}

export type POStatus = 'brouillon' | 'envoyee' | 'partielle' | 'recue'

export interface PurchaseLine { productId: ID; qty: number; received: number; unitCost: number; lotNumber?: string; expiresAt?: string }

export interface PurchaseOrder {
  id: ID
  number: string
  supplierId: ID
  storeId: ID
  status: POStatus
  lines: PurchaseLine[]
  createdAt: string
  expectedAt: string
  invoice?: { number: string; amount: number; paid: boolean; dueAt: string }
}

export type PromoType = 'pourcentage' | 'fixe' | 'categorie' | 'marque' | 'bxgy' | 'flash' | 'saisonniere'

export interface Promotion {
  id: ID
  name: string
  code?: string
  type: PromoType
  value: number
  target?: string
  buyX?: number
  getY?: number
  minAmount?: number
  startsAt: string
  endsAt: string
  active: boolean
  uses: number
  highlight?: boolean
}

export interface Pack {
  id: ID
  slug: string
  name: string
  kind: 'visage' | 'cheveux' | 'imperfections' | 'homme' | 'bebe' | 'solaire'
  tagline: string
  description: string
  productIds: ID[]
  price: number
  steps: string[]
}

export interface Article {
  id: ID
  slug: string
  title: string
  category: string
  excerpt: string
  body: string[]
  readTime: number
  date: string
  cover: string
  productIds: ID[]
}

export interface Review {
  id: ID
  productId: ID
  author: string
  rating: number
  title: string
  text: string
  date: string
  verified: boolean
  hasPhoto?: boolean
  status: 'publie' | 'en_attente'
}

export type Role = 'admin' | 'manager' | 'vendeur' | 'stock' | 'preparateur'

export interface Employee {
  id: ID
  name: string
  email: string
  role: Role
  storeId: ID
  active: boolean
  lastLogin: string
}

export interface Store { id: ID; name: string; city: string; address: string; phone: string; manager: string; openedAt: string }

export interface DeliveryZone {
  id: ID
  name: string
  cities: string[]
  standardFee: number
  expressFee: number
  freeAbove: number
  standardDelay: string
  expressDelay: string
  active: boolean
}

export interface Campaign {
  id: ID
  name: string
  channel: 'email' | 'sms' | 'push'
  segment: string
  status: 'brouillon' | 'programmee' | 'envoyee' | 'auto'
  sent: number
  opened: number
  clicked: number
  revenue: number
  date: string
  subject: string
}

export interface Expense { id: ID; date: string; label: string; category: string; amount: number; storeId: ID }

export interface AppNotification {
  id: ID
  type: 'commande' | 'paiement' | 'expedition' | 'stock' | 'expiration' | 'client' | 'avis' | 'retour_stock'
  title: string
  body: string
  date: string
  read: boolean
  link?: string
}

export interface ChatThread {
  id: ID
  customer: string
  subject: string
  topic: 'produit' | 'commande' | 'assistance'
  messages: { from: 'client' | 'staff' | 'bot'; text: string; date: string }[]
  status: 'ouvert' | 'resolu'
}

export interface Wishlist { id: ID; name: string; productIds: ID[]; alerts: { stock: boolean; price: boolean } }

export interface Tenant {
  id: ID
  name: string
  slug: string
  tagline: string
  primaryColor: string
  plan: PlanId
  status: 'essai' | 'actif' | 'suspendu'
  trialEndsAt: string
  createdAt: string
  settings: {
    currency: string
    pointsPerDh: number // points earned per DH spent (0.1 = 1 pt / 10 DH)
    pointValue: number // DH value of one point on redemption
    vatRate: number
    lowStockDefault: number
  }
}

export type PlanId = 'essentiel' | 'pro' | 'reseau'

export interface Plan {
  id: PlanId
  name: string
  price: number
  yearly: number
  description: string
  limits: { stores: number; users: number; products: number; ecommerce: boolean; marketing: boolean; api: boolean }
  features: string[]
}

export interface TenantData {
  stores: Store[]
  products: Product[]
  lots: Lot[]
  movements: Movement[]
  orders: Order[]
  customers: Customer[]
  suppliers: Supplier[]
  purchaseOrders: PurchaseOrder[]
  promotions: Promotion[]
  packs: Pack[]
  articles: Article[]
  reviews: Review[]
  employees: Employee[]
  zones: DeliveryZone[]
  campaigns: Campaign[]
  expenses: Expense[]
  notifications: AppNotification[]
  chats: ChatThread[]
  permissions: Record<Role, Permission[]>
  analytics: { date: string; visits: number; addToCart: number; checkouts: number }[]
  /** Storefront snapshot only: precomputed by the server so the public API never exposes orders or lot details. */
  insights?: StoreInsights
}

export interface StoreInsights {
  available: Record<ID, number>
  bestSellers: ID[]
  together: Record<ID, ID[]>
  sold: Record<ID, number>
}

export type Permission =
  | 'dashboard.view' | 'ventes.manage' | 'commandes.manage' | 'produits.view' | 'produits.edit'
  | 'prix_achat.view' | 'prix_achat.edit' | 'stock.manage' | 'achats.manage' | 'clients.manage'
  | 'promotions.manage' | 'pos.use' | 'pos.remise' | 'finance.view' | 'employes.manage'
  | 'parametres.manage' | 'analytics.view' | 'marketing.manage'
