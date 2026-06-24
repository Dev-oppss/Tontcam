# TontineApp Backend

Backend Laravel 12 API, PostgreSQL local, sans Docker.

Prerequis locaux :

- PHP avec extensions `pdo_pgsql` et `pgsql`.
- PostgreSQL installe et demarre sur `127.0.0.1:5432`.
- Composer.

## Installation

```powershell
cd backend
composer install
copy .env.example .env
php artisan key:generate
```

Configurer PostgreSQL dans `.env` :

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=tontine_app
DB_USERNAME=postgres
DB_PASSWORD=
DB_SEARCH_PATH=tontine,public
```

Créer la base après installation/démarrage de PostgreSQL :

```powershell
createdb -U postgres tontine_app
php artisan migrate:fresh --seed
php artisan serve
```

Si `createdb` n'est pas reconnu, installer PostgreSQL puis ajouter son dossier `bin` au `PATH`.

Compte de test seed :

```text
email: admin@test.local
password: password
```

## Ce qui est posé

- Backend Laravel 12 recréé depuis zéro.
- Schéma PostgreSQL source branché via migration `script postgreSQL.sql`.
- Modèles Eloquent UUID pour les modules CDC.
- Auth API prévue avec Sanctum et modèle `Utilisateur`.
- Routes REST principales : auth, associations, membres, réunions, tontines, cycles, caisses, prêts, sanctions, social.
- Services métier séparés : tontine, bulletin, caisse, prêt, sanction, réunion, notification, access scope.
- Seeder minimal pour tester login.
- Frontend débranché de l’ancien backend et vidé des données métier.

## À faire ensuite

- Relancer `composer install` quand le réseau Packagist/GitHub est stable.
- Installer/verrouiller Sanctum dans `composer.lock` si Composer n’a pas terminé.
- Implémenter les méthodes métier réelles dans `app/Services`.
- Ajouter Policies/RBAC stricts et middleware RLS utilisateur.
- Brancher le frontend module par module après validation API.
- Compléter les tests métier PHPUnit.

## Commandes cible

```powershell
php artisan migrate:fresh --seed
php artisan test
cd ..\frontend
npm run build
```
