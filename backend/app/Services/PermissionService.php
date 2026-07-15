<?php

namespace App\Services;

use App\Models\PermissionRole;
use App\Models\Utilisateur;
use Illuminate\Support\Facades\Cache;

/**
 * Matrice RBAC pilotée par la table permissions_roles (RG-SEC section 9.2).
 * Un fallback codé en dur est utilisé tant que la table n'est pas seedée,
 * pour que l'application reste sûre par défaut ("fail closed").
 */
class PermissionService
{
    /** Matrice par défaut si aucune ligne n'existe en base pour (role, module, action). */
    private const DEFAULTS = [
        'super_admin' => ['*' => ['*' => true]],
        'controleur' => ['*' => ['view' => true]],
        'president' => [
            '*' => ['view' => true],
            'prets' => ['approve' => true],
            'decisions_ag' => ['create' => true, 'view' => true],
            'reunions' => ['approve' => true],
        ],
        'vice_president' => [
            '*' => ['view' => true],
        ],
        'tresorier' => [
            'caisses' => ['view' => true, 'create' => true, 'update' => true],
            'prets' => ['view' => true, 'create' => true, 'update' => true],
            'tontines' => ['view' => true, 'create' => true, 'update' => true],
            'sanctions' => ['view' => true, 'create' => true, 'update' => true],
            'social' => ['view' => true, 'update' => true],
            'membres' => ['view' => true],
            'reunions' => ['view' => true],
        ],
        'secretaire' => [
            'membres' => ['view' => true, 'create' => true, 'update' => true],
            'reunions' => ['view' => true, 'create' => true, 'update' => true],
            'organisation' => ['view' => true, 'update' => true],
            'tontines' => ['view' => true],
            'caisses' => ['view' => true],
        ],
        'membre' => [
            'portail' => ['view' => true],
        ],
    ];

    public function peut(Utilisateur $utilisateur, string $module, string $action): bool
    {
        $role = $utilisateur->role;

        if ($role === 'super_admin') {
            return true;
        }

        $cle = "rbac:{$role}:{$module}:{$action}";

        return Cache::remember($cle, 300, function () use ($role, $module, $action) {
            $ligne = PermissionRole::where('role', $role)->where('module', $module)->where('action', $action)->first();
            if ($ligne) {
                return (bool) $ligne->autorise;
            }

            // Fallback : matrice codée en dur (module exact, puis wildcard '*')
            return (bool) (self::DEFAULTS[$role][$module][$action]
                ?? self::DEFAULTS[$role]['*'][$action]
                ?? false);
        });
    }

    public function invaliderCache(string $role): void
    {
        // Best effort — les entrées expirent de toute façon sous 5 min.
        Cache::forget("rbac:{$role}");
    }
}
