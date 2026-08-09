<?php

namespace App\Policies;

use App\Models\Membre;
use App\Models\Utilisateur;
use App\Services\PermissionService;

class MembrePolicy
{
    public function __construct(private PermissionService $permissions) {}

    public function viewAny(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'membres', 'view');
    }

    public function view(Utilisateur $utilisateur, Membre $membre): bool
    {
        if ($utilisateur->role === 'membre') {
            return $utilisateur->membre_id === $membre->id;
        }


        return $this->permissions->peut($utilisateur, 'membres', 'view')
            && $membre->association_id === $this->associationId($utilisateur);
    }

    public function create(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'membres', 'create');
    }

    public function update(Utilisateur $utilisateur, Membre $membre): bool
    {
        return $this->permissions->peut($utilisateur, 'membres', 'update')
            && $membre->association_id === $this->associationId($utilisateur);
    }

    public function delete(Utilisateur $utilisateur, Membre $membre): bool
    {
        return $this->permissions->peut($utilisateur, 'membres', 'delete')
            && $membre->association_id === $this->associationId($utilisateur);
    }

    private function associationId(Utilisateur $utilisateur): ?string
    {
        return $utilisateur->loadMissing('membre')->membre?->association_id;
    }
}
