<?php

namespace App\Policies;

use App\Models\Tontine;
use App\Models\Utilisateur;
use App\Services\PermissionService;

class TontinePolicy
{
    public function __construct(private PermissionService $permissions) {}

    public function viewAny(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'tontines', 'view');
    }

    public function view(Utilisateur $utilisateur, Tontine $tontine): bool
    {

        return $this->permissions->peut($utilisateur, 'tontines', 'view')
            && $tontine->association_id === $this->associationId($utilisateur);
    }

    public function create(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'tontines', 'create');
    }

    public function update(Utilisateur $utilisateur, Tontine $tontine): bool
    {
        return $this->permissions->peut($utilisateur, 'tontines', 'update')
            && $tontine->association_id === $this->associationId($utilisateur);
    }

    public function delete(Utilisateur $utilisateur, Tontine $tontine): bool
    {
        return $this->permissions->peut($utilisateur, 'tontines', 'delete')
            && $tontine->association_id === $this->associationId($utilisateur);
    }

    private function associationId(Utilisateur $utilisateur): ?string
    {
        return $utilisateur->loadMissing('membre')->membre?->association_id;
    }
}
