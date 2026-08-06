<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\AccessScopeService;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function __construct(private AccessScopeService $scope, private AuditService $audit) {}

    /**
     * Accès restreint : Super Admin et Contrôleur uniquement (RG-SEC-011).
     * La consultation elle-même est tracée (RG-SEC-012).
     */
    public function index(Request $request): JsonResponse
    {
        if ($request->user()->cannot('access-audit-log')) {
            return response()->json(['message' => "Accès restreint au Super Admin et au Contrôleur."], 403);
        }

        $filtres = $request->only(['module' => $request->get('table'), 'action' => $request->get('action')]);
        $this->audit->journaliserConsultation($request->user(), $filtres);

        $query = AuditLog::where('association_id', $this->scope->associationId($request->user()))
            ->with('utilisateur.membre')
            ->orderByDesc('created_at');

        if ($request->filled('table')) {
            $query->where('table_name', $request->table);
        }
        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }
        if ($request->filled('du') && $request->filled('au')) {
            $query->whereBetween('created_at', [$request->du, $request->au]);
        }

        $logs = $query->paginate($request->integer('per_page', 50));
        $logs->getCollection()->transform(fn (AuditLog $log) => $this->presenter($log));

        return response()->json($logs);
    }

    /** Données métier lisibles, sans divulgation des structures et valeurs internes. */
    private function presenter(AuditLog $log): array
    {
        $modules = [
            'audit_log' => 'Journal d’audit',
            'transactions' => 'Opérations de caisse',
            'tontine.transactions' => 'Opérations de tontine',
            'tontine_transactions' => 'Opérations de tontine',
            'tontines' => 'Tontines',
            'cotisations_tontine' => 'Cotisations de tontine',
            'prets' => 'Prêts',
            'sanctions_membres' => 'Sanctions',
            'decisions_ag' => 'Décisions d’AG',
            'reunions' => 'Réunions',
            'membres' => 'Membres',
            'caisses' => 'Caisses',
        ];
        $resume = match ($log->action) {
            'create' => 'Création enregistrée',
            'update' => 'Modification enregistrée',
            'delete' => 'Suppression enregistrée',
            'view' => 'Consultation enregistrée',
            default => 'Opération enregistrée',
        };

        return [
            'id' => $log->id,
            'created_at' => $log->created_at,
            'utilisateur' => $log->utilisateur?->membre ? [
                'membre' => [
                    'nom' => $log->utilisateur->membre->nom,
                    'prenom' => $log->utilisateur->membre->prenom,
                ],
            ] : ['email' => 'Administrateur'],
            'module' => $modules[$log->table_name] ?? 'Gestion interne',
            'action' => $log->action,
            'resume' => $resume,
        ];
    }
}
