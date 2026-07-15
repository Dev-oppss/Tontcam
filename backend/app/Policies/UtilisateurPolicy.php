<?php

namespace App\Policies;

use App\Models\Utilisateur;
use App\Services\PermissionService;

class UtilisateurPolicy
{
    public function __construct(private PermissionService $permissions) {}

    public function viewAny(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'utilisateurs', 'view');
    }

    public function view(Utilisateur $utilisateur, Utilisateur $cible): bool
    {
        return $utilisateur->id === $cible->id
            || $this->permissions->peut($utilisateur, 'utilisateurs', 'view');
    }

    public function create(Utilisateur $utilisateur): bool
    {
        return $this->permissions->peut($utilisateur, 'utilisateurs', 'create');
    }

    public function update(Utilisateur $utilisateur, Utilisateur $cible): bool
    {
        // Un utilisateur ne peut jamais changer son propre rôle
        if ($utilisateur->id === $cible->id) {
            return true;
        }

        return $this->permissions->peut($utilisateur, 'utilisateurs', 'update');
    }
}
