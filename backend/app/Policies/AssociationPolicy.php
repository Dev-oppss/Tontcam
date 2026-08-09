<?php

namespace App\Policies;

use App\Models\Association;
use App\Models\Utilisateur;
use App\Services\PermissionService;

class AssociationPolicy
{
    public function __construct(private PermissionService $permissions) {}

    public function view(Utilisateur $utilisateur, Association $association): bool
    {
        $mine = $utilisateur->loadMissing('membre')->membre?->association_id;

        return $association->id === $mine;
    }

    public function update(Utilisateur $utilisateur, Association $association): bool
    {
        return $this->view($utilisateur, $association)
            && $this->permissions->peut($utilisateur, 'organisation', 'update');
    }

    public function delete(Utilisateur $utilisateur, Association $association): bool
    {
        return $utilisateur->role === 'super_admin';
    }
}
