<?php

namespace App\Observers;

use App\Services\AuditService;
use Illuminate\Database\Eloquent\Model;

/**
 * Branché sur Transaction, Pret, SanctionMembre, EvenementSocial (voir AppServiceProvider).
 * Journalise automatiquement created/updated/deleted, indépendamment du controller appelant.
 */
class AuditableObserver
{
    public function __construct(private AuditService $audit) {}

    public function created(Model $model): void
    {
        $this->audit->journaliser($this->associationId($model), 'create', $model, null, $model->getAttributes());
    }

    public function updated(Model $model): void
    {
        $this->audit->journaliser($this->associationId($model), 'update', $model, $model->getOriginal(), $model->getChanges());
    }

    public function deleted(Model $model): void
    {
        $this->audit->journaliser($this->associationId($model), 'delete', $model, $model->getOriginal(), null);
    }

    private function associationId(Model $model): ?string
    {
        if (isset($model->association_id)) {
            return $model->association_id;
        }
        // Transaction n'a pas association_id direct → on remonte via la caisse
        if (method_exists($model, 'caisse') && $model->caisse) {
            return $model->caisse->association_id;
        }

        return null;
    }
}
