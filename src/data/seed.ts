import { PRODUCT_ROWS } from './catalog'
import { DEFAULT_PERMISSIONS } from './plans'

export { PLANS, DEFAULT_PERMISSIONS, CATEGORY_LABEL } from './plans'
import { DAY, daysFromNow, iso, rng, slugify, today } from '../lib/format'
import type {
  Article, Campaign, ChatThread, Customer, DeliveryZone, Employee, Expense, Lot, Movement, Order, OrderStatus,
  Pack, Product, PurchaseOrder, Promotion, Review, Role, Store, Supplier, Tenant, TenantData, AppNotification,
} from '../lib/types'

const FIRST = ['Salma', 'Yasmine', 'Imane', 'Khadija', 'Nora', 'Meryem', 'Hajar', 'Sara', 'Leila', 'Ghita', 'Kenza', 'Aya', 'Houda', 'Zineb', 'Fatima Zahra', 'Omar', 'Youssef', 'Mehdi', 'Anas', 'Karim', 'Amine', 'Hamza', 'Reda', 'Othmane', 'Soukaina', 'Nadia', 'Hind', 'Rim', 'Sanaa', 'Ilham', 'Asmae', 'Amal', 'Wiam', 'Chaimae', 'Hiba', 'Ali', 'Adam', 'Ilyas', 'Samir', 'Nabil']
const LAST = ['Benali', 'El Amrani', 'Idrissi', 'Tazi', 'Berrada', 'Alaoui', 'Bennani', 'Chraibi', 'Fassi', 'Lahlou', 'Kettani', 'Sqalli', 'Ouazzani', 'Bensouda', 'Naciri', 'Ziani', 'Hajji', 'Mansouri', 'Belkadi', 'Amrani', 'Sefrioui', 'Guessous', 'Tahiri', 'Bouzidi', 'Filali']
const STREETS = ['Av. Hassan II', 'Bd Mohammed V', 'Rue Ibn Sina', 'Av. des FAR', 'Rue Allal Ben Abdellah', 'Bd Zerktouni', 'Rue Oued Fès', 'Av. Moulay Youssef', 'Hay Riad', 'Quartier Agdal']

const TEMPLATES: Record<string, { composition: string; usage: string; warnings: string }> = {
  visage: { composition: 'Aqua, Glycerin, Niacinamide, Sodium Hyaluronate, Squalane, Panthenol, Allantoin, Tocopherol. Sans parfum, non comédogène.', usage: 'Appliquer matin et/ou soir sur le visage et le cou parfaitement nettoyés, en massant délicatement jusqu’à pénétration.', warnings: 'Usage externe. Éviter le contact avec les yeux. En cas de réaction, arrêter l’utilisation. Tenir hors de portée des enfants.' },
  corps: { composition: 'Aqua, Butyrospermum Parkii Butter, Glycerin, Argania Spinosa Kernel Oil, Ceramide NP, Niacinamide.', usage: 'Appliquer quotidiennement sur l’ensemble du corps, de préférence après la douche sur peau légèrement humide.', warnings: 'Usage externe uniquement. Ne pas appliquer sur une peau lésée.' },
  cheveux: { composition: 'Aqua, Sodium Laureth Sulfate-free base, Hydrolyzed Keratin, Biotin, Panthenol, Caffeine.', usage: 'Appliquer sur cheveux mouillés, masser le cuir chevelu, laisser poser 2 minutes puis rincer abondamment.', warnings: 'En cas de contact avec les yeux, rincer abondamment. Si la chute persiste, consulter un professionnel de santé.' },
  hygiene: { composition: 'Aqua, Coco-Glucoside, Glycerin, Lactic Acid, Aloe Barbadensis Leaf Juice.', usage: 'Utiliser quotidiennement sous la douche ou selon les besoins.', warnings: 'Usage externe. Tenir hors de portée des enfants.' },
  bebe: { composition: 'Formule minimaliste : Aqua, Calendula Officinalis Extract, Zinc Oxide, Glycerin. Sans parfum, sans alcool.', usage: 'Appliquer à chaque change ou lors de la toilette sur une peau propre et sèche.', warnings: 'Testé sous contrôle pédiatrique. Demander conseil à votre pharmacien ou pédiatre pour les nourrissons de moins de 3 mois.' },
  solaire: { composition: 'Filtres UVA/UVB photostables, Aqua, Glycerin, Vitamin E, Thermal Spring Water.', usage: 'Appliquer généreusement avant l’exposition. Renouveler toutes les 2 heures et après chaque baignade.', warnings: 'Ne pas rester trop longtemps au soleil, même avec un produit solaire. Ne pas exposer les bébés et jeunes enfants directement au soleil.' },
  maquillage: { composition: 'Pigments minéraux, Glycerin, Hyaluronic Acid, Squalane. Testé sous contrôle ophtalmologique pour les yeux.', usage: 'Appliquer en fine couche et moduler selon le résultat souhaité.', warnings: 'Refermer après usage. Ne pas partager.' },
  parfumerie: { composition: 'Alcohol Denat., Parfum, Aqua. Contient des allergènes naturels (Limonene, Linalool).', usage: 'Vaporiser sur les points de pulsation : poignets, cou, derrière les oreilles.', warnings: 'Inflammable. Tenir éloigné des sources de chaleur. Ne pas vaporiser vers les yeux.' },
  complements: { composition: 'Ingrédients actifs dosés selon la réglementation en vigueur. Sans gluten.', usage: 'Prendre selon la posologie indiquée sur l’emballage, avec un verre d’eau, au cours d’un repas.', warnings: 'Complément alimentaire : ne se substitue pas à une alimentation variée et équilibrée. Ne pas dépasser la dose journalière recommandée. Déconseillé aux femmes enceintes sans avis médical.' },
  bucco: { composition: 'Aqua, Hydrated Silica, Sorbitol, Sodium Fluoride (1450 ppm F), Zinc Citrate.', usage: 'Brosser les dents au moins deux fois par jour pendant 2 minutes.', warnings: 'Ne pas avaler. Enfants de moins de 6 ans : demander l’avis d’un professionnel.' },
  homme: { composition: 'Aqua, Glycerin, Niacinamide, Caffeine, Allantoin, Menthol.', usage: 'Appliquer matin et soir sur le visage propre, après le rasage.', warnings: 'Usage externe. Éviter le contour des yeux.' },
  femme: { composition: 'Aqua, Centella Asiatica Extract, Rosa Canina Seed Oil, Shea Butter, Vitamin E.', usage: 'Masser quotidiennement sur les zones concernées jusqu’à pénétration complète.', warnings: 'Usage externe. Demander conseil à votre professionnel de santé pendant la grossesse.' },
  accessoires: { composition: 'Matériaux sélectionnés, conformes aux normes en vigueur.', usage: 'Nettoyer régulièrement à l’eau tiède et laisser sécher à l’air libre.', warnings: 'Remplacer régulièrement pour une hygiène optimale.' },
}

const REVIEW_TEXTS: Record<number, [string, string][]> = {
  5: [['Indispensable', 'Je l’utilise depuis trois mois, ma peau n’a jamais été aussi confortable. Je rachète sans hésiter.'], ['Parfait', 'Texture agréable, résultat visible rapidement. Livraison rapide en plus !'], ['Coup de cœur', 'Conseillé par la pharmacienne, je ne regrette pas du tout.'], ['Excellent rapport qualité/prix', 'Efficace et très bien toléré, même par ma peau réactive.']],
  4: [['Très bien', 'Bon produit, efficace. Le flacon pourrait être plus pratique.'], ['Satisfaite', 'Résultats au rendez-vous après quelques semaines.'], ['Bon produit', 'Texture légère, seul bémol le prix un peu élevé.']],
  3: [['Correct', 'Fait le travail mais sans effet waouh.'], ['Mitigé', 'Agréable mais je n’ai pas vu de grande différence.']],
  2: [['Pas pour moi', 'Texture un peu trop riche pour ma peau.']],
}

interface SeedOpts { seed: number; stores: Omit<Store, 'id'>[]; ordersPerDay: number; customers: number; prefix: string }

export function seedTenant(opts: SeedOpts): TenantData {
  const r = rng(opts.seed)
  const t0 = today().getTime()
  const at = (daysAgo: number, hour = r.int(9, 20)) => iso(new Date(t0 - daysAgo * DAY + hour * 3600_000 + r.int(0, 59) * 60_000))
  const px = opts.prefix

  const stores: Store[] = opts.stores.map((s, i) => ({ ...s, id: `${px}st${i + 1}` }))

  const suppliers: Supplier[] = [
    { id: `${px}sup1`, name: 'DermaDistrib Maroc', contact: 'Rachid Berrada', email: 'commandes@dermadistrib.ma', phone: '05 22 45 67 80', city: 'Casablanca', paymentTerms: '60 jours', brands: ['Dermaflore', 'Aqualis', 'Nuvéa'] },
    { id: `${px}sup2`, name: 'Sensilab Afrique du Nord', contact: 'Imane Tazi', email: 'pro@sensilab-an.ma', phone: '05 37 71 22 10', city: 'Rabat', paymentTerms: '45 jours', brands: ['Sensilab', 'Kératine+'] },
    { id: `${px}sup3`, name: 'Botanéa Atelier', contact: 'Fatima Zahra Alaoui', email: 'b2b@botanea.ma', phone: '05 24 43 18 90', city: 'Marrakech', paymentTerms: '30 jours', brands: ['Botanéa', 'Paraflow Select'] },
    { id: `${px}sup4`, name: 'Pharma Kids Import', contact: 'Youssef Lahlou', email: 'orders@pharmakids.ma', phone: '05 22 98 11 45', city: 'Casablanca', paymentTerms: '60 jours', brands: ['Bébénature', 'Solaria'] },
    { id: `${px}sup5`, name: 'Beauté Prestige Distribution', contact: 'Kenza Chraibi', email: 'contact@beauteprestige.ma', phone: '05 22 33 40 12', city: 'Casablanca', paymentTerms: '30 jours', brands: ['Maison Iris', 'Hommage'] },
    { id: `${px}sup6`, name: 'Nutri Santé Maroc', contact: 'Karim Fassi', email: 'ventes@nutrisante.ma', phone: '05 35 62 14 77', city: 'Fès', paymentTerms: '45 jours', brands: ['Vitalis', 'Oralis'] },
  ]
  const supplierFor = (brand: string) => suppliers.find((s) => s.brands.includes(brand))!.id

  const products: Product[] = PRODUCT_ROWS.map((row, i) => {
    const [name, brand, category, subcategory, shape, color, volume, purchase, price, promo, needs, skinTypes, pitch] = row
    const tpl = TEMPLATES[category]
    return {
      id: `p${i + 1}`,
      name, brand, category, subcategory, shape, color, volume,
      ref: `${brand.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X')}-${String(1000 + i * 7).padStart(4, '0')}`,
      barcode: `611${String(3000000000 + i * 104729).slice(0, 10)}`,
      needs, skinTypes,
      description: `${pitch} Formulé pour offrir efficacité et haute tolérance, ce soin ${brand} s’intègre facilement à votre routine quotidienne.`,
      composition: tpl.composition,
      usage: tpl.usage,
      warnings: tpl.warnings,
      purchasePrice: purchase,
      price,
      promoPrice: promo ?? undefined,
      alertThreshold: price > 300 ? 4 : price > 150 ? 6 : 10,
      supplierId: supplierFor(brand),
      rating: 0,
      reviewsCount: 0,
      isNew: i % 9 === 4,
      createdAt: at(r.int(i % 9 === 4 ? 3 : 60, i % 9 === 4 ? 25 : 500)),
      active: true,
    }
  })

  // Popularity drives both sales volume and stock levels.
  const popularity = products.map((p, i) => (i % 7 === 0 ? 3 : i % 5 === 0 ? 2 : 1) * (p.price < 150 ? 1.4 : 1) * (0.6 + r.next()))
  const popTotal = popularity.reduce((a, b) => a + b, 0)
  const pickProduct = () => {
    let x = r.next() * popTotal
    for (let i = 0; i < products.length; i++) { x -= popularity[i]; if (x <= 0) return products[i] }
    return products[0]
  }

  // Lots: deliberately place some expirations in the 7/30/60/90-day windows and some low/out-of-stock items.
  const lots: Lot[] = []
  const movements: Movement[] = []
  let lotSeq = 1
  const expiryPlan = [4, 6, 12, 18, 25, 28, 41, 52, 58, 67, 74, 83, 88]
  products.forEach((p, i) => {
    stores.forEach((s, si) => {
      const nLots = r.chance(0.45) ? 2 : 1
      for (let k = 0; k < nLots; k++) {
        const soon = k === 0 && si === 0 && i % 4 === 1 ? expiryPlan[(i >> 2) % expiryPlan.length] : null
        const expires = soon ?? r.int(120, 760)
        const received = r.int(10, 200)
        let qty = Math.round((8 + popularity[i] * 14) * (0.5 + r.next()) / (k + 1))
        if ((i + si) % 13 === 3) qty = r.int(1, Math.max(1, p.alertThreshold - 2)) // low stock
        if ((i * 3 + si) % 29 === 5) qty = 0 // rupture
        const lot: Lot = {
          id: `${px}lot${lotSeq}`,
          productId: p.id,
          storeId: s.id,
          number: `L${String(24000 + lotSeq * 37).slice(-5)}${String.fromCharCode(65 + (lotSeq % 26))}`,
          qty,
          initialQty: qty + r.int(10, 40),
          receivedAt: at(received),
          expiresAt: iso(daysFromNow(expires)),
          supplierId: p.supplierId,
        }
        lotSeq++
        lots.push(lot)
        movements.push({ id: `${px}mv${movements.length + 1}`, date: lot.receivedAt, type: 'entree', productId: p.id, lotId: lot.id, storeId: s.id, qty: lot.initialQty, note: `Réception lot ${lot.number}`, user: 'Système' })
      }
    })
  })

  const cities = [...new Set(stores.map((s) => s.city)), 'Casablanca', 'Tanger', 'Marrakech', 'Agadir', 'Kénitra']
  const customers: Customer[] = Array.from({ length: opts.customers }, (_, i) => {
    const firstName = r.pick(FIRST)
    const lastName = r.pick(LAST)
    const ageDays = i < opts.customers * 0.1 ? r.int(0, 29) : r.int(30, 540)
    return {
      id: `${px}c${i + 1}`,
      firstName, lastName,
      phone: `06 ${r.int(10, 99)} ${r.int(10, 99)} ${r.int(10, 99)} ${r.int(10, 99)}`,
      email: `${slugify(firstName)}.${slugify(lastName)}${r.int(1, 99)}@mail.ma`,
      address: `${r.int(1, 180)} ${r.pick(STREETS)}`,
      city: r.chance(0.7) ? r.pick(stores).city : r.pick(cities),
      createdAt: at(ageDays),
      points: 0,
      couponsUsed: [],
      favorites: [],
      skinType: r.pick(['seche', 'grasse', 'mixte', 'sensible', 'normale']),
      marketingOptIn: r.chance(0.72),
    }
  })
  // A few loyal "VIP" style customers order much more often.
  const loyalWeight = customers.map((_, i) => (i % 11 === 0 ? 8 : i % 4 === 0 ? 3 : 1))
  const loyalTotal = loyalWeight.reduce((a, b) => a + b, 0)
  const pickCustomer = (maxAge: number) => {
    for (let tries = 0; tries < 6; tries++) {
      let x = r.next() * loyalTotal
      for (let i = 0; i < customers.length; i++) {
        x -= loyalWeight[i]
        if (x <= 0) {
          const c = customers[i]
          if ((t0 - new Date(c.createdAt).getTime()) / DAY >= maxAge) return c
          break
        }
      }
    }
    return undefined
  }

  const zones: DeliveryZone[] = [
    { id: `${px}z1`, name: 'Zone locale', cities: stores.map((s) => s.city), standardFee: 20, expressFee: 40, freeAbove: 400, standardDelay: '24 h', expressDelay: '3 h', active: true },
    { id: `${px}z2`, name: 'Grandes villes', cities: ['Casablanca', 'Tanger', 'Marrakech', 'Kénitra'], standardFee: 35, expressFee: 65, freeAbove: 600, standardDelay: '24–48 h', expressDelay: '24 h', active: true },
    { id: `${px}z3`, name: 'Reste du Maroc', cities: ['Agadir', 'Oujda', 'Laâyoune', 'Tétouan', 'Autre'], standardFee: 45, expressFee: 90, freeAbove: 800, standardDelay: '48–72 h', expressDelay: '48 h', active: true },
  ]
  const zoneFor = (city: string) => zones.find((z) => z.cities.includes(city)) ?? zones[2]

  const orders: Order[] = []
  const cashiers = ['Hajar B.', 'Omar T.', 'Sara L.', 'Nabil F.']
  for (let d = 179; d >= 0; d--) {
    const date = new Date(t0 - d * DAY)
    const weekday = date.getDay()
    const season = 0.78 + (179 - d) / 380 + 0.06 * Math.sin((179 - d) / 9)
    const count = Math.round(opts.ordersPerDay * season * (weekday === 5 ? 0.75 : weekday === 6 ? 1.3 : 1) * (0.75 + r.next() * 0.5))
    for (let k = 0; k < count; k++) {
      const channel: 'web' | 'pos' = r.chance(0.38) ? 'web' : 'pos'
      const store = channel === 'web' ? stores[0] : r.pick(stores)
      const customer = channel === 'web' || r.chance(0.55) ? pickCustomer(d) : undefined
      if (channel === 'web' && !customer) continue
      const nItems = r.chance(0.5) ? 1 : r.chance(0.6) ? 2 : r.int(3, 4)
      const items = new Map<string, { productId: string; qty: number; unitPrice: number; unitCost: number }>()
      for (let j = 0; j < nItems; j++) {
        const p = pickProduct()
        const it = items.get(p.id)
        if (it) it.qty++
        else items.set(p.id, { productId: p.id, qty: 1, unitPrice: p.promoPrice && r.chance(0.6) ? p.promoPrice : p.price, unitCost: p.purchasePrice })
      }
      const list = [...items.values()]
      const subtotal = list.reduce((a, x) => a + x.qty * x.unitPrice, 0)
      const discount = r.chance(0.12) ? Math.round(subtotal * 0.1) : 0
      const zone = customer ? zoneFor(customer.city) : zones[0]
      const mode = r.chance(0.15) ? 'express' : 'standard'
      const shipping = channel === 'web' ? (subtotal - discount >= zone.freeAbove ? 0 : mode === 'express' ? zone.expressFee : zone.standardFee) : 0
      let status: OrderStatus = 'livree'
      if (channel === 'web') {
        if (d === 0) status = r.pick(['recue', 'recue', 'preparation'])
        else if (d === 1) status = r.pick(['preparation', 'expediee', 'expediee'])
        else if (d <= 3) status = r.pick(['expediee', 'livraison', 'livree'])
        if (d > 3 && r.chance(0.03)) status = 'annulee'
      }
      const method = channel === 'pos' ? (r.chance(0.55) ? 'carte' : 'especes') : r.chance(0.55) ? 'carte' : 'livraison'
      const paid = method !== 'livraison' || status === 'livree'
      const createdAt = at(d)
      const flow: OrderStatus[] = ['recue', 'preparation', 'expediee', 'livraison', 'livree']
      const history = channel === 'web'
        ? status === 'annulee' ? [{ status: 'recue' as const, date: createdAt }, { status: 'annulee' as const, date: createdAt }]
          : flow.slice(0, flow.indexOf(status) + 1).map((s, idx) => ({ status: s, date: iso(new Date(new Date(createdAt).getTime() + idx * 9 * 3600_000)) }))
        : [{ status: 'livree' as const, date: createdAt }]
      const seq = orders.length + 1
      orders.push({
        id: `${px}o${seq}`,
        number: `${channel === 'web' ? 'WEB' : 'POS'}-${String(10000 + seq)}`,
        channel,
        storeId: store.id,
        customerId: customer?.id,
        items: list,
        subtotal, discount, shipping,
        total: subtotal - discount + shipping,
        status,
        payment: { method, status: status === 'annulee' ? 'rembourse' : paid ? 'paye' : 'en_attente' },
        delivery: channel === 'web' && customer ? { mode, zoneId: zone.id, address: customer.address, city: customer.city, carrier: status === 'recue' || status === 'preparation' ? undefined : r.pick(['Coursier interne', 'Amana Express', 'CTM Messagerie']), tracking: status === 'expediee' || status === 'livraison' || status === 'livree' ? `TRK${r.int(100000, 999999)}` : undefined } : undefined,
        history,
        createdAt,
        cashier: channel === 'pos' ? r.pick(cashiers) : undefined,
      })
    }
  }

  // Loyalty points & favourites derived from purchase history.
  const byCustomer = new Map<string, Order[]>()
  orders.forEach((o) => { if (o.customerId && o.status !== 'annulee') { const a = byCustomer.get(o.customerId) ?? []; a.push(o); byCustomer.set(o.customerId, a) } })
  customers.forEach((c) => {
    const os = byCustomer.get(c.id) ?? []
    const spent = os.reduce((a, o) => a + o.total, 0)
    c.points = Math.max(0, Math.floor(spent / 10) - r.int(0, Math.floor(spent / 40)))
    const counts = new Map<string, number>()
    os.forEach((o) => o.items.forEach((it) => counts.set(it.productId, (counts.get(it.productId) ?? 0) + it.qty)))
    c.favorites = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id)
    if (os.length > 3 && r.chance(0.5)) c.couponsUsed = r.chance(0.5) ? ['BIENVENUE10'] : ['BIENVENUE10', 'ETE15']
  })

  // Reviews → ratings.
  const reviews: Review[] = []
  products.forEach((p, i) => {
    const n = r.int(3, 12) + (popularity[i] > 2 ? 6 : 0)
    for (let k = 0; k < n; k++) {
      const rating = r.chance(0.62) ? 5 : r.chance(0.7) ? 4 : r.chance(0.7) ? 3 : 2
      const [title, text] = r.pick(REVIEW_TEXTS[rating])
      reviews.push({ id: `${px}rv${reviews.length + 1}`, productId: p.id, author: `${r.pick(FIRST)} ${r.pick(LAST).charAt(0)}.`, rating, title, text, date: at(r.int(1, 300)), verified: r.chance(0.8), hasPhoto: r.chance(0.15), status: k === 0 && i % 6 === 0 ? 'en_attente' : 'publie' })
    }
    const pub = reviews.filter((x) => x.productId === p.id && x.status === 'publie')
    p.rating = Math.round((pub.reduce((a, x) => a + x.rating, 0) / pub.length) * 10) / 10
    p.reviewsCount = pub.length
  })

  // Recent operational stock movements.
  const mvTypes: [Movement['type'], string][] = [['ajustement', 'Casse en rayon'], ['ajustement', 'Produit endommagé à la réception'], ['inventaire', 'Inventaire tournant — écart'], ['transfert', 'Rééquilibrage inter-boutiques'], ['sortie', 'Échantillons / démonstration'], ['retour', 'Retour client — produit non ouvert']]
  for (let k = 0; k < 28; k++) {
    const [type, note] = r.pick(mvTypes)
    if (type === 'transfert' && stores.length < 2) continue
    const p = pickProduct()
    const store = r.pick(stores)
    const to = stores.find((s) => s.id !== store.id)
    movements.push({ id: `${px}mv${movements.length + 1}`, date: at(r.int(0, 25)), type, productId: p.id, storeId: store.id, toStoreId: type === 'transfert' ? to?.id : undefined, qty: type === 'retour' || type === 'transfert' ? r.int(1, 6) : -r.int(1, 3), note, user: r.pick(['Hajar B.', 'Mehdi A.', 'Nadia K.']) })
  }

  const purchaseOrders: PurchaseOrder[] = [
    ['brouillon', 0, 2, 0], ['envoyee', 1, 4, 3], ['envoyee', 3, 3, 6], ['partielle', 0, 12, 2], ['recue', 1, 20, 0], ['recue', 2, 35, 0], ['recue', 4, 50, 0], ['recue', 5, 64, 0],
  ].map(([status, supIdx, ago, eta], i) => {
    const sup = suppliers[supIdx as number]
    const prods = products.filter((p) => p.supplierId === sup.id).slice(0, 4)
    const lines = prods.map((p, j) => {
      const qty = 12 + j * 6
      const received = status === 'recue' ? qty : status === 'partielle' ? (j % 2 === 0 ? qty : Math.floor(qty / 2)) : 0
      return { productId: p.id, qty, received, unitCost: p.purchasePrice, lotNumber: received ? `L${r.int(30000, 39999)}R` : undefined, expiresAt: received ? iso(daysFromNow(r.int(300, 700))) : undefined }
    })
    const amount = lines.reduce((a, l) => a + l.qty * l.unitCost, 0)
    return {
      id: `${px}po${i + 1}`,
      number: `BC-2026-${String(140 + i).padStart(4, '0')}`,
      supplierId: sup.id,
      storeId: stores[i % stores.length].id,
      status: status as PurchaseOrder['status'],
      lines,
      createdAt: at(ago as number),
      expectedAt: iso(daysFromNow(eta as number)),
      invoice: status === 'recue' || status === 'partielle' ? { number: `FAC-${sup.name.slice(0, 3).toUpperCase()}-${r.int(1000, 9999)}`, amount, paid: (ago as number) > 30, dueAt: iso(daysFromNow(60 - (ago as number))) } : undefined,
    }
  })

  const promotions: Promotion[] = [
    { id: `${px}pr1`, name: 'Bienvenue — 10 % sur la 1re commande', code: 'BIENVENUE10', type: 'pourcentage', value: 10, startsAt: at(200), endsAt: iso(daysFromNow(365)), active: true, uses: 214 },
    { id: `${px}pr2`, name: 'Semaine du solaire', type: 'categorie', target: 'solaire', value: 15, startsAt: at(3), endsAt: iso(new Date(Date.now() + 3 * DAY + 5 * 3600_000)), active: true, uses: 86, highlight: true },
    { id: `${px}pr3`, name: '50 DH offerts dès 500 DH', code: 'ECLAT50', type: 'fixe', value: 50, minAmount: 500, startsAt: at(10), endsAt: iso(daysFromNow(20)), active: true, uses: 41 },
    { id: `${px}pr4`, name: 'Nuvéa −20 %', type: 'marque', target: 'Nuvéa', value: 20, startsAt: at(40), endsAt: at(10), active: false, uses: 132 },
    { id: `${px}pr5`, name: 'Dentifrice : 2 achetés = 1 offert', type: 'bxgy', target: 'p44', buyX: 2, getY: 1, value: 0, startsAt: at(5), endsAt: iso(daysFromNow(25)), active: true, uses: 57 },
    { id: `${px}pr6`, name: 'Vente flash Sérum vitamine C', type: 'flash', target: 'p5', value: 25, startsAt: at(0, 8), endsAt: iso(new Date(Date.now() + 9 * 3600_000)), active: true, uses: 19 },
    { id: `${px}pr7`, name: 'Été 2026 — 15 % dès 300 DH', code: 'ETE15', type: 'saisonniere', value: 15, minAmount: 300, startsAt: at(90), endsAt: at(20), active: false, uses: 388 },
  ]

  const packs: Pack[] = [
    { id: `${px}pk1`, slug: 'routine-peau-seche', name: 'Routine Skin Care — Peau sèche', kind: 'visage', tagline: 'Nettoyer, repulper, nourrir, protéger', description: 'Quatre gestes essentiels pour restaurer le confort des peaux sèches et déshydratées.', productIds: ['p1', 'p3', 'p4', 'p27'], price: 699, steps: ['Nettoyant', 'Sérum', 'Crème hydratante', 'SPF'] },
    { id: `${px}pk2`, slug: 'routine-anti-imperfections', name: 'Routine Anti-imperfections', kind: 'imperfections', tagline: 'Purifier sans agresser', description: 'Une routine ciblée pour réduire les imperfections et matifier durablement.', productIds: ['p10', 'p6', 'p9', 'p27'], price: 529, steps: ['Gel moussant', 'Soin ciblé', 'Masque (2×/sem.)', 'SPF'] },
    { id: `${px}pk3`, slug: 'routine-cheveux', name: 'Routine Cheveux — Force & densité', kind: 'cheveux', tagline: 'Contre la chute saisonnière', description: 'Shampooing, sérum et complément pour une chevelure plus dense.', productIds: ['p16', 'p18', 'p39'], price: 559, steps: ['Shampooing', 'Sérum cuir chevelu', 'Complément'] },
    { id: `${px}pk4`, slug: 'routine-homme', name: 'Routine Homme — Essentiel', kind: 'homme', tagline: 'Simple, efficace, rapide', description: 'Trois produits pour une peau nette et reposée en moins de 2 minutes.', productIds: ['p47', 'p48', 'p49'], price: 369, steps: ['Nettoyant 3-en-1', 'Hydratant', 'Après-rasage'] },
    { id: `${px}pk5`, slug: 'routine-bebe', name: 'Routine Bébé — Change & toilette', kind: 'bebe', tagline: 'Douceur au quotidien', description: 'Tout le nécessaire pour la toilette et le change de bébé.', productIds: ['p23', 'p24', 'p25', 'p26'], price: 299, steps: ['Liniment', 'Crème change', 'Gel lavant', 'Crème visage'] },
    { id: `${px}pk6`, slug: 'routine-solaire', name: 'Routine Solaire — Vacances', kind: 'solaire', tagline: 'Protéger, apaiser', description: 'Protection visage et corps, puis réparation après l’exposition.', productIds: ['p27', 'p28', 'p30'], price: 469, steps: ['SPF visage', 'SPF corps', 'Après-soleil'] },
  ]

  const articles: Article[] = [
    { id: `${px}a1`, slug: 'construire-routine-skincare-simple', title: 'Comment construire une routine skincare simple ?', category: 'Conseils skincare', excerpt: 'Nettoyer, traiter, hydrater, protéger : les quatre étapes qui suffisent pour une peau en bonne santé.', readTime: 6, date: at(4), cover: '#e3ebe4', productIds: ['p1', 'p3', 'p4', 'p27'], body: ['Une routine efficace n’a pas besoin de dix étapes. Pour la plupart des peaux, quatre gestes bien choisis suffisent à entretenir une barrière cutanée saine.', '## 1. Nettoyer en douceur', 'Matin et soir, utilisez un nettoyant adapté à votre type de peau. Évitez les formules trop décapantes qui fragilisent le film hydrolipidique.', '## 2. Traiter avec un sérum', 'Le sérum concentre les actifs : acide hyaluronique pour l’hydratation, vitamine C pour l’éclat, niacinamide pour les imperfections.', '## 3. Hydrater', 'Une crème adaptée scelle l’hydratation. Texture riche pour les peaux sèches, fluide pour les peaux mixtes à grasses.', '## 4. Protéger', 'Le SPF est le meilleur geste anti-âge. Appliquez-le chaque matin, même en hiver.', 'En cas de problème de peau persistant, demandez conseil à votre pharmacien ou consultez un dermatologue.'] },
    { id: `${px}a2`, slug: 'bien-choisir-protection-solaire', title: 'Bien choisir sa protection solaire', category: 'Protection solaire', excerpt: 'SPF, UVA, texture, résistance à l’eau : le guide pour protéger toute la famille.', readTime: 5, date: at(12), cover: '#f6e8cf', productIds: ['p27', 'p28', 'p31'], body: ['Le soleil marocain est intense toute l’année : la protection solaire est un geste quotidien.', '## SPF 30 ou 50 ?', 'Pour une exposition prolongée, en montagne ou à la plage, préférez un SPF 50+. Les enfants et les peaux claires doivent toujours être protégés au maximum.', '## Quelle quantité ?', 'Comptez l’équivalent de deux doigts de produit pour le visage. Renouvelez toutes les deux heures.', 'Les bébés de moins d’un an ne doivent pas être exposés directement au soleil.'] },
    { id: `${px}a3`, slug: 'chute-de-cheveux-saisonniere', title: 'Chute de cheveux saisonnière : que faire ?', category: 'Conseils cheveux', excerpt: 'Pourquoi perd-on plus de cheveux en automne et comment accompagner la repousse.', readTime: 4, date: at(20), cover: '#efe3d0', productIds: ['p16', 'p18', 'p39'], body: ['Perdre jusqu’à 100 cheveux par jour est normal. À l’automne, cette chute peut s’intensifier temporairement.', '## Les bons réflexes', 'Un shampooing doux et fortifiant, un sérum pour le cuir chevelu et une alimentation riche en protéines, fer et zinc.', 'Si la chute dure plus de trois mois ou apparaît par plaques, consultez un médecin.'] },
    { id: `${px}a4`, slug: 'routine-bebe-premiers-mois', title: 'La routine de bébé les premiers mois', category: 'Bébé', excerpt: 'Toilette, change, hydratation : les gestes essentiels et les produits à privilégier.', readTime: 5, date: at(33), cover: '#f6f0e3', productIds: ['p23', 'p24', 'p25'], body: ['La peau de bébé est plus fine et plus perméable que celle de l’adulte : moins de produits, mais bien choisis.', '## Le change', 'Le liniment oléo-calcaire nettoie et protège. En cas de rougeurs, une crème à l’oxyde de zinc crée une barrière.', 'Demandez toujours conseil à votre pédiatre en cas d’irritation persistante.'] },
    { id: `${px}a5`, slug: 'hygiene-bucco-dentaire-gestes', title: 'Hygiène bucco-dentaire : les 5 gestes essentiels', category: 'Hygiène', excerpt: 'Brossage, fil, bain de bouche : une routine simple pour des gencives en bonne santé.', readTime: 3, date: at(41), cover: '#e1eef2', productIds: ['p44', 'p45', 'p46'], body: ['Deux minutes, deux fois par jour : la règle d’or du brossage.', '## Choisir sa brosse', 'Des brins souples protègent l’émail et les gencives.', 'Un contrôle chez le dentiste une fois par an reste indispensable.'] },
    { id: `${px}a6`, slug: 'guide-vitamine-c', title: 'Guide produit : tout savoir sur la vitamine C', category: 'Guides produits', excerpt: 'Concentrations, association avec d’autres actifs, conservation : notre guide complet.', readTime: 7, date: at(55), cover: '#f6dcb4', productIds: ['p5', 'p27'], body: ['Antioxydant de référence, la vitamine C illumine le teint et protège des agressions extérieures.', '## Matin ou soir ?', 'Le matin, sous votre SPF, pour renforcer la protection antioxydante.', '## Conservation', 'À l’abri de la lumière et de la chaleur. Une couleur qui fonce signale une oxydation.'] },
  ]

  const employees: Employee[] = [
    ['Sallam Lebriji', 'admin', 0], ['Nadia Kettani', 'manager', 0], ['Hajar Bennani', 'vendeur', 0], ['Mehdi Alaoui', 'stock', 0], ['Aya Ziani', 'preparateur', 0],
    ['Omar Tazi', 'manager', 1], ['Sara Lahlou', 'vendeur', 1], ['Reda Fassi', 'stock', 1], ['Nabil Filali', 'vendeur', 2], ['Kenza Idrissi', 'manager', 2],
  ].filter(([, , s]) => (s as number) < stores.length).map(([name, role, s], i) => ({
    id: `${px}e${i + 1}`, name: name as string, role: role as Role, storeId: stores[s as number].id, active: i !== 7,
    email: `${slugify((name as string).split(' ')[0])}@${px ? 'atlas' : 'seve'}-para.ma`, lastLogin: at(r.int(0, 6)),
  }))

  const campaigns: Campaign[] = [
    { id: `${px}cp1`, name: 'Relance panier abandonné', channel: 'email', segment: 'Paniers abandonnés', status: 'auto', sent: 412, opened: 238, clicked: 96, revenue: 18450, date: at(0), subject: 'Vous avez oublié quelque chose dans votre panier' },
    { id: `${px}cp2`, name: 'Lancement Semaine du solaire', channel: 'email', segment: 'Tous les clients (opt-in)', status: 'envoyee', sent: 1840, opened: 796, clicked: 211, revenue: 24300, date: at(3), subject: '☀️ −15 % sur tout le solaire cette semaine' },
    { id: `${px}cp3`, name: 'Clients inactifs — on vous a manqué', channel: 'sms', segment: 'Clients inactifs', status: 'envoyee', sent: 320, opened: 0, clicked: 44, revenue: 6120, date: at(14), subject: '−15 % pour votre retour avec le code RETOUR15' },
    { id: `${px}cp4`, name: 'Anniversaire client', channel: 'email', segment: 'Anniversaire du mois', status: 'auto', sent: 96, opened: 61, clicked: 28, revenue: 3880, date: at(1), subject: 'Joyeux anniversaire : un cadeau vous attend' },
    { id: `${px}cp5`, name: 'Rentrée cheveux', channel: 'push', segment: 'Acheteurs catégorie Cheveux', status: 'programmee', sent: 0, opened: 0, clicked: 0, revenue: 0, date: iso(daysFromNow(2)), subject: 'Chute saisonnière : notre routine force & densité' },
    { id: `${px}cp6`, name: 'Newsletter conseils d’octobre', channel: 'email', segment: 'Tous les clients (opt-in)', status: 'brouillon', sent: 0, opened: 0, clicked: 0, revenue: 0, date: iso(daysFromNow(6)), subject: '5 conseils pour préparer sa peau à l’hiver' },
  ]

  const expenses: Expense[] = []
  for (let m = 0; m < 6; m++) {
    stores.forEach((s, si) => {
      const d = at(m * 30 + 2)
      expenses.push({ id: `${px}x${expenses.length + 1}`, date: d, label: 'Loyer', category: 'Loyer', amount: [14000, 11000, 16500][si % 3], storeId: s.id })
      expenses.push({ id: `${px}x${expenses.length + 1}`, date: d, label: 'Salaires', category: 'Salaires', amount: [32000, 24000, 26000][si % 3], storeId: s.id })
      expenses.push({ id: `${px}x${expenses.length + 1}`, date: d, label: 'Électricité & eau', category: 'Charges', amount: r.int(1800, 3200), storeId: s.id })
    })
    expenses.push({ id: `${px}x${expenses.length + 1}`, date: at(m * 30 + 8), label: 'Campagnes digitales', category: 'Marketing', amount: r.int(4000, 9000), storeId: stores[0].id })
    expenses.push({ id: `${px}x${expenses.length + 1}`, date: at(m * 30 + 10), label: 'Abonnement Paraflow', category: 'Logiciels', amount: 2490, storeId: stores[0].id })
  }

  const notifications: AppNotification[] = [
    { id: `${px}n1`, type: 'commande', title: 'Nouvelle commande en ligne', body: 'WEB-' + (10000 + orders.length) + ' — à préparer', date: at(0, 10), read: false, link: '/admin/commandes' },
    { id: `${px}n2`, type: 'stock', title: 'Stock faible', body: 'Plusieurs produits sont passés sous le seuil minimum.', date: at(0, 9), read: false, link: '/admin/stock' },
    { id: `${px}n3`, type: 'expiration', title: 'Lots bientôt expirés', body: 'Des lots expirent dans moins de 7 jours.', date: at(0, 8), read: false, link: '/admin/lots' },
    { id: `${px}n4`, type: 'avis', title: 'Nouvel avis à modérer', body: 'Un client a laissé un avis sur « Gel nettoyant doux purifiant ».', date: at(1, 16), read: false, link: '/admin/ecommerce' },
    { id: `${px}n5`, type: 'paiement', title: 'Paiement confirmé', body: 'Paiement carte reçu pour une commande web.', date: at(1, 12), read: true, link: '/admin/commandes' },
    { id: `${px}n6`, type: 'client', title: 'Nouveau client', body: 'Un nouveau client vient de créer son compte.', date: at(1, 11), read: true, link: '/admin/clients' },
    { id: `${px}n7`, type: 'expedition', title: 'Commande expédiée', body: 'Remise au transporteur Amana Express.', date: at(2, 15), read: true, link: '/admin/livraisons' },
  ]

  const chats: ChatThread[] = [
    { id: `${px}ch1`, customer: 'Salma Benali', subject: 'Sérum vitamine C et peau sensible ?', topic: 'produit', status: 'ouvert', messages: [{ from: 'client', text: 'Bonjour, est-ce que le sérum vitamine C convient aux peaux sensibles ?', date: at(0, 11) }] },
    { id: `${px}ch2`, customer: 'Youssef Tazi', subject: 'Où en est ma commande ?', topic: 'commande', status: 'ouvert', messages: [{ from: 'client', text: 'Bonjour, ma commande WEB-12104 est-elle expédiée ?', date: at(0, 9) }, { from: 'bot', text: 'Votre commande est en cours de préparation. Un conseiller va vous répondre.', date: at(0, 9) }] },
    { id: `${px}ch3`, customer: 'Meryem Idrissi', subject: 'Échange de produit', topic: 'assistance', status: 'resolu', messages: [{ from: 'client', text: 'Puis-je échanger une crème non ouverte ?', date: at(2, 14) }, { from: 'staff', text: 'Bien sûr, sous 14 jours avec votre ticket, dans n’importe laquelle de nos boutiques.', date: at(2, 15) }] },
  ]

  const analytics = Array.from({ length: 180 }, (_, i) => {
    const d = 179 - i
    const day = iso(new Date(t0 - d * DAY)).slice(0, 10)
    const webOrders = orders.filter((o) => o.channel === 'web' && o.createdAt.slice(0, 10) === day).length
    const checkouts = Math.round(webOrders * (1.35 + r.next() * 0.2))
    const addToCart = Math.round(checkouts * (2.6 + r.next() * 0.6))
    const visits = Math.round(webOrders / (0.022 + r.next() * 0.008)) + r.int(20, 80)
    return { date: day, visits, addToCart, checkouts }
  })

  const out: TenantData = {
    stores, products, lots, movements, orders, customers, suppliers, purchaseOrders, promotions, packs, articles, reviews,
    employees, zones, campaigns, expenses, notifications, chats, permissions: structuredClone(DEFAULT_PERMISSIONS), analytics,
  }
  return px ? prefixProductIds(out, px) : out
}

/** Product ids (`p1`…) come from the shared catalogue; prefix them so they stay unique across tenants in one database. */
function prefixProductIds(d: TenantData, px: string): TenantData {
  const m = (id: string) => (/^p\d+$/.test(id) ? px + id : id)
  d.products.forEach((p) => { p.id = m(p.id) })
  d.lots.forEach((l) => { l.productId = m(l.productId) })
  d.movements.forEach((x) => { x.productId = m(x.productId) })
  d.orders.forEach((o) => o.items.forEach((i) => { i.productId = m(i.productId) }))
  d.customers.forEach((c) => { c.favorites = c.favorites.map(m) })
  d.purchaseOrders.forEach((po) => po.lines.forEach((l) => { l.productId = m(l.productId) }))
  d.promotions.forEach((p) => { if (p.target) p.target = m(p.target) })
  d.packs.forEach((p) => { p.productIds = p.productIds.map(m) })
  d.articles.forEach((a) => { a.productIds = a.productIds.map(m) })
  d.reviews.forEach((r) => { r.productId = m(r.productId) })
  return d
}

export function seedAll(): { tenants: Tenant[]; data: Record<string, TenantData> } {
  const now = today()
  const tenants: Tenant[] = [
    { id: 't_seve', name: 'Parapharmacie Sève', slug: 'seve', tagline: 'Votre peau, notre expertise', primaryColor: '#5f7d68', plan: 'reseau', status: 'actif', trialEndsAt: iso(new Date(now.getTime() - 200 * DAY)), createdAt: iso(new Date(now.getTime() - 214 * DAY)), settings: { currency: 'MAD', pointsPerDh: 0.1, pointValue: 0.5, vatRate: 20, lowStockDefault: 8 } },
    { id: 't_atlas', name: 'Parapharmacie Atlas', slug: 'atlas', tagline: 'Le soin au naturel', primaryColor: '#8a6f4d', plan: 'pro', status: 'essai', trialEndsAt: iso(new Date(now.getTime() + 9 * DAY)), createdAt: iso(new Date(now.getTime() - 5 * DAY)), settings: { currency: 'MAD', pointsPerDh: 0.1, pointValue: 0.5, vatRate: 20, lowStockDefault: 8 } },
  ]
  return {
    tenants,
    data: {
      t_seve: seedTenant({ seed: 42, prefix: '', ordersPerDay: 16, customers: 180, stores: [
        { name: 'Sève Meknès', city: 'Meknès', address: '12 Av. Hassan II, Ville Nouvelle', phone: '05 35 52 10 10', manager: 'Nadia Kettani', openedAt: '2019-03-01' },
        { name: 'Sève Fès', city: 'Fès', address: '48 Bd Allal Ben Abdellah', phone: '05 35 94 22 30', manager: 'Omar Tazi', openedAt: '2021-09-15' },
        { name: 'Sève Rabat', city: 'Rabat', address: '7 Av. Fal Ould Oumeir, Agdal', phone: '05 37 68 40 55', manager: 'Kenza Idrissi', openedAt: '2023-05-20' },
      ] }),
      t_atlas: seedTenant({ seed: 7, prefix: 'at_', ordersPerDay: 5, customers: 50, stores: [
        { name: 'Atlas Casablanca', city: 'Casablanca', address: '101 Bd Zerktouni, Maârif', phone: '05 22 25 90 90', manager: 'Karim Amrani', openedAt: '2024-01-10' },
      ] }),
    },
  }
}

