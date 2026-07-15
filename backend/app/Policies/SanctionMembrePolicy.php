<?php

namespace App\Policies;

use App\Models\SanctionMembre;
use App\Models\Utilisateur;
use App\Services\PermissionService;

class SanctionMembrePolicy
{
    public function __construct(private PermissionService $permissions) {}

    public function viewAny(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'sanctions', 'view');
    }

    public function view(Utilisateur $utilisateur, SanctionMembre $sanction): bool
    {
        if ($utilisateur->role === 'membre') {
            return $utilisateur->membre_id === $sanction->membre_id;
        }


        return $this->permissions->peut($utilisateur, 'sanctions', 'view')
            && $sanction->association_id === $this->associationId($utilisateur);
    }

    public function create(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'sanctions', 'create');
    }

    public function update(Utilisateur $utilisateur, SanctionMembre $sanction): bool
    {
        return $this->permissions->peut($utilisateur, 'sanctions', 'update')
            && $sanction->association_id === $this->associationId($utilisateur);
    }

    public function delete(Utilisateur $utilisateur, SanctionMembre $sanction): bool
    {
        return $this->permissions->peut($utilisateur, 'sanctions', 'delete')
            && $sanction->association_id === $this->associationId($utilisateur);
    }

    private function associationId(Utilisateur $utilisateur): ?string
    {
        return $utilisateur->loadMissing('membre')->membre?->association_id;
    }
}
