<?php

namespace App\Providers;

use App\Models\Association;
use App\Models\AuditLog;
use App\Models\BulletinGain;
use App\Models\Caisse;
use App\Models\CompteBancaire;
use App\Models\CycleTontine;
use App\Models\EvenementSocial;
use App\Models\Membre;
use App\Models\Pret;
use App\Models\RetenueBulletin;
use App\Models\Reunion;
use App\Models\SanctionMembre;
use App\Models\Tontine;
use App\Models\TypeAideSociale;
use App\Models\TypeSanction;
use App\Policies\SensitiveResourcePolicy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Services metier resolus par le conteneur Laravel.
    }

    public function boot(): void
    {
        Model::shouldBeStrict(! app()->isProduction());
        foreach ([
            Association::class,
            Membre::class,
            Reunion::class,
            Caisse::class,
            CompteBancaire::class,
            Tontine::class,
            CycleTontine::class,
            BulletinGain::class,
            RetenueBulletin::class,
            Pret::class,
            SanctionMembre::class,
            EvenementSocial::class,
            TypeSanction::class,
            TypeAideSociale::class,
            AuditLog::class,
        ] as $model) {
            Gate::policy($model, SensitiveResourcePolicy::class);
        }
        Gate::define('view-audit-log', fn ($user) => in_array($user->role ?? null, ['super_admin', 'controleur', 'admin'], true));
        Gate::define('export-personal-data', fn ($user) => in_array($user->role ?? null, ['super_admin', 'admin', 'president', 'tresorier'], true));
    }
}
