# Paraflow — SaaS de gestion pour parapharmacies

ERP + POS + CRM + E-commerce + Stock + Logistique + Marketing + Analytics + Fidélité, dans une seule plateforme multi-tenant.

**Stack :** React + TypeScript + Tailwind (front) · Node.js + Express + TypeScript (API) · **MySQL / MariaDB** via Prisma.

## Prérequis

- Node.js 20+
- MySQL 8 ou MariaDB 10.4+ (ex. XAMPP) en cours d’exécution

## Installation

```bash
npm install
cd server && npm install
```

Configurer `server/.env` (copier `server/.env.example`) : `DATABASE_URL`, `JWT_SECRET`, `DEMO_PASSWORD`.
Créer la base puis les tables et les données de démonstration :

```bash
cd server && npx prisma db push && npm run db:seed
```

## Lancer en développement

Deux terminaux :

```bash
cd server && npm run dev
```

```bash
npm run dev
```

L’API écoute sur http://localhost:4100 et le front (Vite) relaie `/api` vers elle.

## Déploiement

Le frontend utilise automatiquement `/api/v1` via le proxy Vite en local et
`https://parapharmacie-ssgh.onrender.com/api/v1` en production. Pour un autre serveur,
définir `VITE_API_URL` dans l'environnement de build du frontend (avec le suffixe `/api/v1`),
puis relancer le build.

Sur Render, le service API doit utiliser le dossier `server` comme **Root Directory**, avec
`npm install && npx prisma generate` comme **Build Command** et `npm start` comme **Start Command**.
Configurer `DATABASE_URL` vers une base MySQL/MariaDB persistante, `JWT_SECRET` avec une valeur
aléatoire longue et `NODE_ENV=production`. `CORS_ORIGIN` peut contenir les origines frontend
autorisées séparées par des virgules ; si absent en production, l'API autorise toutes les origines
(n'utilisant pas de cookies). Dans les variables Render, définir `CORS_ORIGIN=*` pour autoriser le
frontend et les boutiques clientes sur leurs domaines. Le schéma doit être appliqué à la base avec
`npx prisma db push`.

Ne pas lancer `npm run db:seed` sur une base contenant des données à conserver : ce script vide
les tables avant de recréer les comptes et données de démonstration.

| Espace | URL | Contenu |
|---|---|---|
| Landing SaaS | `/` | Présentation, tarifs, FAQ, démo |
| Connexion | `/connexion` | Comptes de démonstration par rôle |
| Essai gratuit | `/inscription` | Crée un nouvel espace (tenant) isolé en base |
| Back-office | `/admin` | Les 20 modules + messages clients |
| Boutique | `/boutique?boutique=seve` | E-commerce public d’un tenant |
| Console opérateur | `/console` | Tenants, abonnements, MRR |

## Comptes de démonstration

`npm run db:seed` crée deux parapharmacies isolées (*Sève*, 3 boutiques, plan Réseau ; *Atlas*, 1 boutique, en essai) et affiche la liste des comptes. Tous utilisent le mot de passe `DEMO_PASSWORD` de `server/.env` (repris en local dans `.env.development.local` pour les boutons de connexion rapide).

## Tests

```bash
cd server && npm test
```

Les tests d’intégration tournent sur une base MySQL séparée (`paraflow_test`, recréée à chaque exécution) : authentification, permissions par rôle, isolation entre tenants, recalcul serveur des prix, FEFO, ventes simultanées sur la dernière unité, achats, inscription, limites de plan, console opérateur.

## Structure

```
src/              front-end React (pages, composants, règles métier partagées dans src/lib/logic.ts)
server/
  prisma/schema.prisma   schéma MySQL
  src/app.ts             application Express
  src/db.ts              client Prisma + isolation par tenant
  src/auth.ts            JWT, rôles, permissions
  src/routes/            auth, back-office, boutique publique, opérateur
  src/domain/            stock (FEFO, verrous), ventes, achats, import
  src/seed.ts            données de démonstration
  tests/                 tests d’intégration
docs/ARCHITECTURE.md     architecture détaillée
```
