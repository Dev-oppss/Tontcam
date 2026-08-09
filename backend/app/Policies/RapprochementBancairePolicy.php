<?php

namespace App\Policies;

use App\Models\RapprochementBancaire;
use App\Models\Utilisateur;
use App\Services\PermissionService;

class RapprochementBancairePolicy
{
    public function __construct(private PermissionService $permissions) {}

    public function viewAny(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'caisses', 'view');
    }

    public function view(Utilisateur $utilisateur, RapprochementBancaire $rapprochement): bool
    {
        return $this->permissions->peut($utilisateur, 'caisses', 'view')
            && $rapprochement->caisse?->association_id === $this->associationId($utilisateur);
    }

    public function create(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'caisses', 'create');
    }

    public function update(Utilisateur $utilisateur, RapprochementBancaire $rapprochement): bool
    {
        // La justification d'écart est réservée au Trésorier (RG-CAI-018)
        return $this->permissions->peut($utilisateur, 'caisses', 'update')
            && $rapprochement->caisse?->association_id === $this->associationId($utilisateur);
    }

    private function associationId(Utilisateur $utilisateur): ?string
    {
        return $utilisateur->loadMissing('membre')->membre?->association_id;
    }
}
