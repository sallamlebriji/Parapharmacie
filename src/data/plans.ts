import { CATEGORIES } from './catalog'
import type { Permission, Role } from '../lib/types'

export const PLANS = [
  { id: 'essentiel' as const, name: 'Essentiel', price: 490, yearly: 4900, description: 'Pour une parapharmacie indépendante qui digitalise sa gestion.', limits: { stores: 1, users: 3, products: 1500, ecommerce: false, marketing: false, api: false }, features: ['Stock, lots & expirations', 'Caisse POS', 'CRM & fidélité', 'Tableau de bord', 'Support email'] },
  { id: 'pro' as const, name: 'Pro', price: 990, yearly: 9900, description: 'La plateforme complète avec votre boutique en ligne.', limits: { stores: 2, users: 10, products: 8000, ecommerce: true, marketing: true, api: false }, features: ['Tout Essentiel', 'Boutique e-commerce', 'Promotions & packs', 'Marketing & relances', 'Analytics avancés', 'Support prioritaire'] },
  { id: 'reseau' as const, name: 'Réseau', price: 2490, yearly: 24900, description: 'Pour les groupes multi-boutiques et les franchises.', limits: { stores: 20, users: 100, products: 50000, ecommerce: true, marketing: true, api: true }, features: ['Tout Pro', 'Multi-boutiques illimité*', 'Dashboard direction', 'API & intégrations', 'Rôles personnalisés', 'Account manager dédié'] },
]

const ALL_PERMS: Permission[] = ['dashboard.view', 'ventes.manage', 'commandes.manage', 'produits.view', 'produits.edit', 'prix_achat.view', 'prix_achat.edit', 'stock.manage', 'achats.manage', 'clients.manage', 'promotions.manage', 'pos.use', 'pos.remise', 'finance.view', 'employes.manage', 'parametres.manage', 'analytics.view', 'marketing.manage']

export const DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL_PERMS,
  manager: ALL_PERMS.filter((p) => !['parametres.manage', 'employes.manage'].includes(p)),
  vendeur: ['dashboard.view', 'ventes.manage', 'produits.view', 'clients.manage', 'pos.use', 'commandes.manage'],
  stock: ['dashboard.view', 'produits.view', 'produits.edit', 'prix_achat.view', 'stock.manage', 'achats.manage'],
  preparateur: ['commandes.manage', 'produits.view'],
}

export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label])) as Record<string, string>

/** Loyalty rewards catalogue (points → voucher). Validated server-side on redemption. */
export const REWARDS = [
  { cost: 100, label: 'Bon de 50 DH', desc: 'Utilisable dès 200 DH d’achat' },
  { cost: 200, label: 'Bon de 100 DH', desc: 'Sur tout le site et en boutique' },
  { cost: 350, label: 'Soin découverte offert', desc: 'Format voyage au choix' },
  { cost: 600, label: 'Diagnostic de peau + routine', desc: 'Avec une conseillère en boutique' },
]
