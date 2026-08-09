<?php

namespace App\Policies;

use App\Models\Caisse;
use App\Models\Utilisateur;
use App\Services\PermissionService;

class CaissePolicy
{
    public function __construct(private PermissionService $permissions) {}

    public function viewAny(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'caisses', 'view');
    }

    public function view(Utilisateur $utilisateur, Caisse $caisse): bool
    {

        return $this->permissions->peut($utilisateur, 'caisses', 'view')
            && $caisse->association_id === $this->associationId($utilisateur);
    }

    public function create(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'caisses', 'create');
    }

    public function update(Utilisateur $utilisateur, Caisse $caisse): bool
    {
        return $this->permissions->peut($utilisateur, 'caisses', 'update')
            && $caisse->association_id === $this->associationId($utilisateur);
    }

    public function delete(Utilisateur $utilisateur, Caisse $caisse): bool
    {
        return $this->permissions->peut($utilisateur, 'caisses', 'delete')
            && $caisse->association_id === $this->associationId($utilisateur);
    }

    private function associationId(Utilisateur $utilisateur): ?string
    {
        return $utilisateur->loadMissing('membre')->membre?->association_id;
    }
}
