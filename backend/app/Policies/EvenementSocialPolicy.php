<?php

namespace App\Policies;

use App\Models\EvenementSocial;
use App\Models\Utilisateur;
use App\Services\PermissionService;

class EvenementSocialPolicy
{
    public function __construct(private PermissionService $permissions) {}

    public function viewAny(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'social', 'view');
    }

    public function view(Utilisateur $utilisateur, EvenementSocial $evenement): bool
    {
        if ($utilisateur->role === 'membre') {
            return $utilisateur->membre_id === $evenement->membre_id;
        }


        return $this->permissions->peut($utilisateur, 'social', 'view')
            && $evenement->association_id === $this->associationId($utilisateur);
    }

    public function create(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'social', 'create');
    }

    public function update(Utilisateur $utilisateur, EvenementSocial $evenement): bool
    {
        return $this->permissions->peut($utilisateur, 'social', 'update')
            && $evenement->association_id === $this->associationId($utilisateur);
    }

    public function delete(Utilisateur $utilisateur, EvenementSocial $evenement): bool
    {
        return $this->permissions->peut($utilisateur, 'social', 'delete')
            && $evenement->association_id === $this->associationId($utilisateur);
    }

    private function associationId(Utilisateur $utilisateur): ?string
    {
        return $utilisateur->loadMissing('membre')->membre?->association_id;
    }
}
