<?php

namespace App\Providers;

use App\Models\Association;
use App\Models\Caisse;
use App\Models\DecisionAg;
use App\Models\EvenementSocial;
use App\Models\Membre;
use App\Models\Poste;
use App\Models\Pret;
use App\Models\RapprochementBancaire;
use App\Models\ReglementInterieur;
use App\Models\Reunion;
use App\Models\SanctionMembre;
use App\Models\Tontine;
use App\Models\Transaction;
use App\Models\Utilisateur;
use App\Observers\AuditableObserver;
use App\Policies\AssociationPolicy;
use App\Policies\CaissePolicy;
use App\Policies\DecisionAgPolicy;
use App\Policies\EvenementSocialPolicy;
use App\Policies\MembrePolicy;
use App\Policies\PostePolicy;
use App\Policies\PretPolicy;
use App\Policies\RapprochementBancairePolicy;
use App\Policies\ReglementInterieurPolicy;
use App\Policies\ReunionPolicy;
use App\Policies\SanctionMembrePolicy;
use App\Policies\TontinePolicy;
use App\Policies\UtilisateurPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Gate::policy(Association::class, AssociationPolicy::class);
        Gate::policy(Membre::class, MembrePolicy::class);
        Gate::policy(Reunion::class, ReunionPolicy::class);
        Gate::policy(Tontine::class, TontinePolicy::class);
        Gate::policy(Caisse::class, CaissePolicy::class);
        Gate::policy(Pret::class, PretPolicy::class);
        Gate::policy(SanctionMembre::class, SanctionMembrePolicy::class);
        Gate::policy(EvenementSocial::class, EvenementSocialPolicy::class);
        Gate::policy(Utilisateur::class, UtilisateurPolicy::class);
        Gate::policy(Poste::class, PostePolicy::class);
        Gate::policy(DecisionAg::class, DecisionAgPolicy::class);
        Gate::policy(ReglementInterieur::class, ReglementInterieurPolicy::class);
        Gate::policy(RapprochementBancaire::class, RapprochementBancairePolicy::class);

        // Journal d'audit : accès global restreint (RG-SEC-011), pas de policy par enregistrement.
        Gate::define('access-audit-log', fn (Utilisateur $u) => in_array($u->role, ['super_admin', 'controleur'], true));

        // Exports CSV/XLSX : réservé aux rôles ayant accès en lecture aux données financières/membres.
        Gate::define('export-personal-data', fn (Utilisateur $u) => in_array($u->role, ['super_admin', 'president', 'tresorier', 'secretaire', 'controleur'], true));

        Transaction::observe(AuditableObserver::class);
        Pret::observe(AuditableObserver::class);
        SanctionMembre::observe(AuditableObserver::class);
        EvenementSocial::observe(AuditableObserver::class);
    }
}
