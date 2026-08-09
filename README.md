# TONTIX — Plateforme de gestion de tontines

TONTIX est une application web de gestion pour les associations de tontine. Elle centralise les opérations d’épargne collective, la gouvernance de l’association et la traçabilité financière dans un espace sécurisé, multi-association et fondé sur des règles métier explicites.

Le produit vise en priorité les associations qui opèrent en XAF, notamment au Cameroun, tout en restant paramétrable (devise, pays, règles internes, seuils de validation).

## Ce que le produit permet de gérer

- **Organisation** : création d’association, configuration, statuts, règlement intérieur, postes et historique des mandats.
- **Membres et accès** : fiches membres, comptes utilisateurs, rôles, activation/désactivation, portail membre et profil personnel.
- **Réunions** : planification, présences, ordre du jour, rapports, opérations de séance, procès-verbal PDF et signatures.
- **Tontines** : parts multiples, cotisations, cycles, rotation, tirage au sort, enchères, calendrier, planification des tours et bulletins de gain.
- **Finance** : caisses, comptes bancaires, journaux, transferts, rapprochements et écritures d’entrée/sortie.
- **Prêts** : demande, validation, approbation selon seuil, décaissement, échéancier, remboursement et historique.
- **Sanctions et social** : types de sanctions, règlements, aides sociales, assurances et décisions d’assemblée générale.
- **Pilotage** : tableau de bord, exports CSV/XLSX/PDF, rapports et journal d’audit.

## Principes métier et sécurité

Chaque utilisateur est rattaché à un membre, lui-même rattaché à une association. Les données sont isolées par association ; le backend positionne le contexte d’association à chaque requête et le schéma PostgreSQL active des politiques RLS sur les ressources sensibles.

Les droits sont organisés par rôle : `super_admin`, `president`, `vice_president`, `tresorier`, `secretaire`, `controleur` et `membre`. Le portail membre limite l’accès aux données personnelles autorisées. Les opérations sensibles — finance, prêts, sanctions, bulletins et membres — sont journalisées.

Les workflows financiers s’exécutent dans des transactions applicatives. Par exemple, une cotisation crée une entrée de caisse ; un décaissement de prêt crée une sortie ; un remboursement recrédite la caisse. Les règles de montant, de statut et d’enchaînement sont contrôlées côté serveur.

## Architecture

| Couche | Technologie | Responsabilité |
| --- | --- | --- |
| Interface | React 18, Vite, Tailwind CSS | Application métier, formulaires, tableaux de bord et exports client |
| API | Laravel 12, PHP 8.2+, Sanctum | Authentification, autorisations, services métier et génération de documents |
| Données | PostgreSQL 16 | Schéma métier, UUID, contraintes, index, triggers et RLS |
| Documents | Dompdf, XLSX/CSV | Bulletins, PV, relevés, rapports et exports |

```text
frontend/                 Application React/Vite
  src/pages/              Écrans métier
  src/context/            État applicatif et appels API
  src/lib/                Client HTTP, adaptateurs et exports

backend/                  API Laravel
  app/Http/Controllers/Api/  Endpoints REST
  app/Services/           Workflows métier
  app/Models/             Modèles Eloquent
  app/Policies/           Autorisations
  database/migrations/    Schéma, RLS et évolutions
  resources/views/pdf/    Gabarits PDF

database/                 Scripts SQL et données de démonstration de référence
```

## Prérequis

- PHP **8.2+** avec les extensions PostgreSQL (`pdo_pgsql`, `pgsql`).
- Composer 2.
- PostgreSQL 16 ou compatible, démarré localement.
- Node.js compatible avec Vite 8 et npm.

La base doit autoriser la création du schéma `tontine` ainsi que les extensions PostgreSQL utilisées par les migrations : `uuid-ossp`, `pgcrypto`, `unaccent` et `pg_trgm`.

## Démarrage local

### 1. Préparer la base PostgreSQL

Créez une base locale, par exemple `tontine_app`, avec un utilisateur disposant des droits nécessaires :

```powershell
createdb -U postgres tontine_app
```

### 2. Démarrer l’API

```powershell
cd backend
composer install
Copy-Item .env.example .env
php artisan key:generate
```

Dans `backend/.env`, vérifiez au minimum :

```env
APP_URL=http://127.0.0.1:8000
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=tontine_app
DB_USERNAME=postgres
DB_PASSWORD=
DB_SEARCH_PATH=tontine,public
```

Initialisez le schéma et les données de démonstration, puis lancez l’API :

```powershell
php artisan migrate:fresh --seed
php artisan serve
```

L’API est alors disponible sur `http://127.0.0.1:8000/api`.

### 3. Démarrer l’interface

Dans un second terminal :

```powershell
cd frontend
npm install
npm run dev
```

Par défaut, l’interface est accessible sur `http://127.0.0.1:5173` et appelle l’API sur `http://127.0.0.1:8000/api`.

Pour utiliser une autre URL d’API, créez `frontend/.env.local` :

```env
VITE_API_URL=http://127.0.0.1:8000/api
```

## Comptes de démonstration

Après `php artisan migrate:fresh --seed` :

| Rôle | Adresse | Mot de passe |
| --- | --- | --- |
| Administrateur | `admin@test.local` | `password` |
| Trésorier | `tresorier@test.local` | `password` |
| Membre | `membre@test.local` | `password` |
| Premier accès | `first@test.local` | `password` |

Le compte « Premier accès » permet de vérifier le changement obligatoire de mot de passe.

> Ces comptes sont réservés au développement. Ils ne doivent jamais être utilisés en production.

## Vérification

```powershell
# Depuis backend/
php artisan test

# Depuis frontend/
npm run build
```

Pour vérifier la disponibilité de l’API :

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

## API

Les routes sont regroupées sous `/api`. À l’exception de l’authentification et du contrôle de santé, elles nécessitent un jeton Sanctum :

```http
Authorization: Bearer <token>
```

Principaux domaines :

| Domaine | Exemples de ressources |
| --- | --- |
| Authentification | `/auth/register`, `/auth/login`, `/auth/me` |
| Membres | `/membres`, `/membres/import-csv`, `/membres/{id}/situation` |
| Réunions | `/reunions`, `/reunions/{id}/presences`, `/reunions/{id}/signer` |
| Tontines | `/tontines`, `/cycles/{id}/cotisations`, `/cycles/{id}/designer-gagnant` |
| Finance | `/caisses`, `/caisses/{id}/transactions`, `/caisses/transferts` |
| Prêts | `/prets`, `/prets/{id}/valider`, `/prets/{id}/rembourser` |
| Social et sanctions | `/sanctions`, `/aides-sociales`, `/assurances` |
| Restitution | `/exports/*`, `/audit-log`, `/portail/moi` |

La liste exhaustive et les règles d’accès sont définies dans [`backend/routes/api.php`](backend/routes/api.php).

## État du projet

Les flux fondamentaux sont implémentés : authentification, isolation par association, gestion des membres, caisses, prêts, cycles de tontine, bulletins, réunions, sanctions, social, exports et audit.

Le produit continue d’évoluer. Les priorités habituelles de consolidation sont la couverture complète des tests métier, l’enrichissement de certaines interfaces de workflow et l’activation de canaux réels de notification (SMS, e-mail ou WhatsApp), aujourd’hui préparés par le domaine de notification.

## Documentation de référence

- `cahier de charges TONTIX_020731.pdf` : expression du besoin.
- `TontineApp_Regles_de_Gestion.docx` : règles métier détaillées.
- `script postgreSQL.sql` : référence SQL métier historique.
- `CDC_ET_TESTS.md` : état fonctionnel et scénarios de vérification.

## Conventions de contribution

- Préserver l’isolation par `association_id` dans toute nouvelle fonctionnalité.
- Placer les workflows métier dans `backend/app/Services`, pas dans les contrôleurs.
- Ajouter ou adapter des tests pour toute règle financière ou changement de statut.
- Ne pas contourner les politiques Laravel ni les contraintes PostgreSQL.
- Ne jamais versionner de fichier `.env`, de secrets ou de données de production.

---

TONTIX est conçu pour faire de la tontine un système de gestion fiable : des décisions mieux documentées, des mouvements financiers traçables et une information utile pour les responsables comme pour les membres.
