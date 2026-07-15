<?php

namespace App\Policies;

use App\Models\Poste;
use App\Models\Utilisateur;
use App\Services\PermissionService;

class PostePolicy
{
    public function __construct(private PermissionService $permissions) {}

    public function viewAny(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'organisation', 'view');
    }

    public function view(Utilisateur $utilisateur, Poste $poste): bool
    {
        return $this->permissions->peut($utilisateur, 'organisation', 'view')
            && $poste->association_id === $this->associationId($utilisateur);
    }

    public function create(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'organisation', 'update');
    }

    /** Attribution/clôture de mandat = mise à jour de l'organisation. */
    public function update(Utilisateur $utilisateur, Poste $poste): bool
    {
        return $this->permissions->peut($utilisateur, 'organisation', 'update')
            && $poste->association_id === $this->associationId($utilisateur);
    }

    private function associationId(Utilisateur $utilisateur): ?string
    {
        return $utilisateur->loadMissing('membre')->membre?->association_id;
    }
}
