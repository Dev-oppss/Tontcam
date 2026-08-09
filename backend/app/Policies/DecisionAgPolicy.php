<?php

namespace App\Policies;

use App\Models\DecisionAg;
use App\Models\Utilisateur;
use App\Services\PermissionService;

/**
 * Le registre des décisions d'AG est immuable une fois créé (RG-SOC-014) :
 * pas de update()/delete() exposée, volontairement.
 */
class DecisionAgPolicy
{
    public function __construct(private PermissionService $permissions) {}

    public function viewAny(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'organisation', 'view');
    }

    public function view(Utilisateur $utilisateur, DecisionAg $decision): bool
    {
        return $decision->association_id === $this->associationId($utilisateur);
    }

    public function create(Utilisateur $utilisateur): bool
    {
        // Seuls Président et Secrétaire peuvent enregistrer une décision d'AG.
        // Le président est déclaré via le module 'decisions_ag' (PermissionService::DEFAULTS),
        // le secrétaire via 'organisation'/'reunions' — les deux checks sont nécessaires,
        // sinon le président (pourtant explicitement autorisé dans DEFAULTS) est bloqué.
        return $this->permissions->peut($utilisateur, 'decisions_ag', 'create')
            || $this->permissions->peut($utilisateur, 'organisation', 'update')
            || $this->permissions->peut($utilisateur, 'reunions', 'update');
    }

    private function associationId(Utilisateur $utilisateur): ?string
    {
        return $utilisateur->loadMissing('membre')->membre?->association_id;
    }
}
