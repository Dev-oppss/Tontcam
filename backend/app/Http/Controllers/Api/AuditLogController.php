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

        return response()->json($query->paginate($request->integer('per_page', 50)));
    }
}
