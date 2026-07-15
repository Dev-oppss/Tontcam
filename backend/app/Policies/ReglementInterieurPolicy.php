<?php

namespace App\Policies;

use App\Models\ReglementInterieur;
use App\Models\Utilisateur;
use App\Services\PermissionService;

class ReglementInterieurPolicy
{
    public function __construct(private PermissionService $permissions) {}

    public function viewAny(Utilisateur $utilisateur): bool
    {
        return true; // tout membre authentifié peut consulter le règlement
    }

    public function view(Utilisateur $utilisateur, ReglementInterieur $reglement): bool
    {
        return $reglement->association_id === $this->associationId($utilisateur);
    }

    public function create(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'organisation', 'update');
    }

    private function associationId(Utilisateur $utilisateur): ?string
    {
        return $utilisateur->loadMissing('membre')->membre?->association_id;
    }
}
