<?php

namespace App\Providers;

use App\Models\Association;
use App\Models\AuditLog;
use App\Models\Caisse;
use App\Models\EvenementSocial;
use App\Models\Membre;
use App\Models\Pret;
use App\Models\Reunion;
use App\Models\SanctionMembre;
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
        foreach ([Association::class, Membre::class, Reunion::class, Caisse::class, Pret::class, SanctionMembre::class, EvenementSocial::class, AuditLog::class] as $model) {
            Gate::policy($model, SensitiveResourcePolicy::class);
        }
        Gate::define('view-audit-log', fn ($user) => in_array($user->role ?? null, ['super_admin', 'controleur'], true));
        Gate::define('export-personal-data', fn ($user) => in_array($user->role ?? null, ['super_admin', 'president', 'tresorier'], true));
    }
}
