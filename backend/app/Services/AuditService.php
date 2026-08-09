<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Utilisateur;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request as RequestFacade;

/**
 * Traçabilité immuable (RG-SEC-009/010). Jamais de update/delete sur audit_log.
 */
class AuditService
{
    public function journaliser(string $associationId, string $action, Model $model, ?array $avant = null, ?array $apres = null): AuditLog
    {
        return AuditLog::create([
            'association_id' => $associationId,
            'utilisateur_id' => Auth::id(),
            'action' => $action,
            'table_name' => $model->getTable(),
            'record_id' => $model->getKey(),
            'valeur_avant' => $avant,
            'valeur_apres' => $apres,
            'ip_address' => RequestFacade::ip(),
        ]);
    }

    /**
     * La consultation du journal d'audit est elle-même tracée (RG-SEC-012),
     * en réutilisant action='view' sur la table audit_log.
     */
    public function journaliserConsultation(Utilisateur $utilisateur, array $filtres = []): AuditLog
    {
        return AuditLog::create([
            'association_id' => $utilisateur->loadMissing('membre')->membre?->association_id,
            'utilisateur_id' => $utilisateur->id,
            'action' => 'view',
            'table_name' => 'audit_log',
            'valeur_apres' => ['filtres' => $filtres],
            'ip_address' => RequestFacade::ip(),
        ]);
    }
}
