<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class AuditLogController extends CrudController
{
    protected string $model = AuditLog::class;
    protected array $filterable = ['association_id', 'utilisateur_id', 'table_name', 'action'];

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('view-audit-log');

        AuditLog::create([
            'association_id' => $request->user()?->membre?->association_id,
            'utilisateur_id' => $request->user()?->id,
            'action' => 'view',
            'table_name' => 'audit_log',
            'valeur_apres' => ['filters' => $request->query()],
            'ip_address' => $request->ip(),
        ]);

        return parent::index($request);
    }
}
