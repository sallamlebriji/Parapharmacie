# Paraflow — Architecture

## 1. Vue d'ensemble

```
 Navigateur ─────────────────────────────────────────────────────────────
   Landing · Back-office · POS · Boutique (par tenant) · Console opérateur
   React + TypeScript — état client : src/lib/store.ts, appels : src/lib/api.ts
                              │  HTTPS /api/v1  (JWT)
 Serveur ────────────────────▼──────────────────────────────────────────
   Express + TypeScript (server/src)
     routes/auth.ts      connexion employé / opérateur, inscription (essai)
     routes/staff.ts     back-office : JWT + permissions + isolation tenant
     routes/store.ts     boutique publique /store/:slug (catalogue, commande…)
     routes/operator.ts  console SaaS (abonnements uniquement)
     domain/             stock (FEFO + verrous), ventes, achats, import
   Règles métier partagées avec le front : src/lib/logic.ts
                              │  Prisma
 Base ───────────────────────▼──────────────────────────────────────────
   MySQL 8 / MariaDB 10.4+ — server/prisma/schema.prisma
```

## 2. Multi-tenant et isolation

- **Modèle** : base partagée, colonne `tenantId` sur chaque table métier.
- MySQL n'a pas de Row-Level Security : l'isolation est appliquée par l'extension Prisma `tenantDb(tenantId)` (`server/src/db.ts`). Toute requête passant par ce client reçoit le filtre `tenantId` (lectures, mises à jour, suppressions) et la valeur `tenantId` (créations) ; une tentative de changer le `tenantId` d'une ligne est ignorée.
- Le `tenantId` provient uniquement du jeton JWT de l'employé, jamais de la requête.
- Les requêtes SQL brutes (verrous `SELECT … FOR UPDATE`) passent le `tenantId` explicitement.
- Vérifié par les tests : un administrateur de Sève qui tente de modifier un produit ou une commande d'Atlas reçoit un 404 et la ligne reste intacte.

## 3. Authentification et permissions

| Jeton | Obtenu par | Accès |
|---|---|---|
| `staff` | `POST /auth/login`, `POST /auth/signup` | Back-office de son tenant, selon la matrice rôle × permission du tenant |
| `customer` | `POST /store/:slug/auth/login` / `register`, ou après une commande | Ses commandes, favoris, points, conversations |
| `operator` | `POST /auth/login` (compte opérateur) | `/operator/*` uniquement |

Mots de passe hachés avec bcrypt, jetons JWT (12 h), limitation de débit sur la connexion, l'inscription et le checkout. Exemples de permissions appliquées par le serveur : sans `prix_achat.view`, les prix d'achat et coûts sont remplacés par 0 dans toutes les réponses ; sans `prix_achat.edit`, une modification de produit conserve le prix d'achat existant ; sans `pos.remise`, une vente avec remise est refusée ; un vendeur n'encaisse que dans sa boutique.

## 4. Règles métier (serveur)

| Règle | Implémentation |
|---|---|
| Prix | Recalculés côté serveur (`computeCart`, `priceOf`). Les montants envoyés par le client sont ignorés, en ligne comme en caisse. |
| Stock réservé | Une commande web réserve le stock de l'entrepôt web (1re boutique) ; la commande est refusée si physique − réservé est insuffisant. |
| FEFO | À l'expédition web et en caisse, les lots sont prélevés du plus proche de la péremption au plus lointain. |
| Concurrence | Les lots concernés sont verrouillés (`SELECT … FOR UPDATE`) dans la transaction : deux ventes simultanées de la dernière unité ne peuvent pas réussir toutes les deux (testé). |
| Numérotation | WEB-/POS-/RET- séquentiels par tenant, contrainte d'unicité + nouvel essai en cas de collision. |
| Retours | Limités à la quantité achetée moins les retours précédents ; stock réintégré ; points ajustés. |
| Achats | Réception partielle ou totale → création des lots + mouvements d'entrée ; facture fournisseur. |
| Fidélité | Points gagnés et utilisés selon les réglages du tenant ; récompenses validées côté serveur. |
| Codes promo | Jamais listés publiquement ; validés un par un (`GET /store/:slug/coupons/:code`) puis à nouveau à la commande. |
| Plans | Limites boutiques / utilisateurs / produits, marketing et boutique en ligne selon le plan. |

## 5. Synchronisation POS ↔ stock ↔ e-commerce

Toutes les ventes (caisse, web) passent par la même transaction serveur. Chaque mutation renvoie les lignes modifiées (`changes`) que le front fusionne dans son état. Le back-office interroge `GET /sync?since=` toutes les 20 s pour récupérer les commandes, lots, mouvements, notifications et messages modifiés sur d'autres postes. La boutique n'affiche que la disponibilité calculée par le serveur (`insights.available`) ; elle ne reçoit ni lots ni commandes d'autres clients.

## 6. Points d'extension

- **Paiement en ligne** : aujourd'hui le paiement par carte est simulé (commande « payée » immédiatement). À brancher : création d'une session chez le prestataire (CMI…), puis passage à `paye` par webhook.
- **Messagerie** : l'envoi de campagnes calcule l'audience et enregistre l'envoi ; le branchement d'un fournisseur email/SMS se fait dans un worker.
- **Transporteurs** : interface commune (création d'envoi, étiquette, suivi par webhook).
- **Applications mobiles** : consomment la même API (`/api/v1`, `GET /reports/dashboard` prévu pour un tableau de bord mobile).

## 7. Exploitation

- Schéma : `npx prisma db push` (développement) ; pour la production, passer à `prisma migrate` pour versionner les migrations.
- Sauvegardes : `mysqldump` quotidien chiffré.
- Données personnelles : traitement conforme à la loi 09-08 (CNDP).
- Le chatbot et le quiz n'établissent aucun diagnostic et orientent vers un professionnel de santé pour toute question médicale.
