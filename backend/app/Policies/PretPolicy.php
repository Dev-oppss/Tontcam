<?php

namespace App\Policies;

use App\Models\Pret;
use App\Models\Utilisateur;
use App\Services\PermissionService;

class PretPolicy
{
    public function __construct(private PermissionService $permissions) {}

    public function viewAny(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'prets', 'view');
    }

    public function view(Utilisateur $utilisateur, Pret $pret): bool
    {
        if ($utilisateur->role === 'membre') {
            return $utilisateur->membre_id === $pret->emprunteur_id;
        }


        return $this->permissions->peut($utilisateur, 'prets', 'view')
            && $pret->caisse?->association_id === $this->associationId($utilisateur);
    }

    public function create(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'prets', 'create');
    }

    public function update(Utilisateur $utilisateur, Pret $pret): bool
    {
        return $this->permissions->peut($utilisateur, 'prets', 'update')
            && $pret->caisse?->association_id === $this->associationId($utilisateur);
    }

    public function delete(Utilisateur $utilisateur, Pret $pret): bool
    {
        return $this->permissions->peut($utilisateur, 'prets', 'delete')
            && $pret->caisse?->association_id === $this->associationId($utilisateur);
    }

    public function approve(Utilisateur $utilisateur, Pret $pret): bool
    {
        return $this->permissions->peut($utilisateur, 'prets', 'approve');
    }

    private function associationId(Utilisateur $utilisateur): ?string
    {
        return $utilisateur->loadMissing('membre')->membre?->association_id;
    }
}
