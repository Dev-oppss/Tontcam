<?php

namespace Database\Seeders;

use App\Models\PermissionRole;
use Illuminate\Database\Seeder;

/**
 * Matrice RBAC par défaut, alignée sur le cahier des charges section 6.2 :
 * SUPER_ADMIN (tout) / PRESIDENT (lecture + validation) / TRESORIER (financier)
 * SECRETAIRE (organisationnel) / CONTROLEUR (lecture seule) / MEMBRE (soi-même).
 */
class PermissionsRolesSeeder extends Seeder
{
    private const MODULES = [
        'organisation', 'membres', 'reunions', 'tontines', 'caisses',
        'prets', 'sanctions', 'social', 'rapports', 'utilisateurs', 'audit',
    ];

    private const ACTIONS = ['view', 'create', 'update', 'delete', 'approve'];

    public function run(): void
    {
        $matrice = [
            'super_admin' => $this->tout(true),
            'controleur' => $this->tout(false, ['view' => true]),
            'president' => array_merge(
                $this->tout(false, ['view' => true]),
                [
                    'prets' => ['view' => true, 'approve' => true],
                    'reunions' => ['view' => true, 'approve' => true],
                    'organisation' => ['view' => true, 'update' => true],
                ]
            ),
            'vice_president' => $this->tout(false, ['view' => true]),
            'tresorier' => [
                'caisses' => ['view' => true, 'create' => true, 'update' => true],
                'prets' => ['view' => true, 'create' => true, 'update' => true],
                'tontines' => ['view' => true, 'create' => true, 'update' => true],
                'sanctions' => ['view' => true, 'create' => true, 'update' => true],
                'social' => ['view' => true, 'update' => true],
                'membres' => ['view' => true],
                'reunions' => ['view' => true],
                'rapports' => ['view' => true],
            ],
            'secretaire' => [
                'membres' => ['view' => true, 'create' => true, 'update' => true],
                'reunions' => ['view' => true, 'create' => true, 'update' => true],
                'organisation' => ['view' => true, 'update' => true],
                'tontines' => ['view' => true],
                'caisses' => ['view' => true],
                'rapports' => ['view' => true],
            ],
            'membre' => [
                'reunions' => ['view' => true],
                'tontines' => ['view' => true],
            ],
        ];

        foreach ($matrice as $role => $modules) {
            foreach ($modules as $module => $actions) {
                foreach ($actions as $action => $autorise) {
                    PermissionRole::updateOrCreate(
                        ['role' => $role, 'module' => $module, 'action' => $action],
                        ['autorise' => $autorise]
                    );
                }
            }
        }
    }

    private function tout(bool $valeur, array $override = []): array
    {
        $modules = [];
        foreach (self::MODULES as $module) {
            $modules[$module] = $override ?: array_fill_keys(self::ACTIONS, $valeur);
        }

        return $modules;
    }
}
