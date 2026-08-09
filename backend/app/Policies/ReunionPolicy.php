<?php

namespace App\Policies;

use App\Models\Reunion;
use App\Models\Utilisateur;
use App\Services\PermissionService;

class ReunionPolicy
{
    public function __construct(private PermissionService $permissions) {}

    public function viewAny(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'reunions', 'view');
    }

    public function view(Utilisateur $utilisateur, Reunion $reunion): bool
    {

        return $this->permissions->peut($utilisateur, 'reunions', 'view')
            && $reunion->association_id === $this->associationId($utilisateur);
    }

    public function create(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'reunions', 'create');
    }

    public function update(Utilisateur $utilisateur, Reunion $reunion): bool
    {
        return $this->permissions->peut($utilisateur, 'reunions', 'update')
            && $reunion->association_id === $this->associationId($utilisateur);
    }

    public function delete(Utilisateur $utilisateur, Reunion $reunion): bool
    {
        return $this->permissions->peut($utilisateur, 'reunions', 'delete')
            && $reunion->association_id === $this->associationId($utilisateur);
    }

    private function associationId(Utilisateur $utilisateur): ?string
    {
        return $utilisateur->loadMissing('membre')->membre?->association_id;
    }
}
