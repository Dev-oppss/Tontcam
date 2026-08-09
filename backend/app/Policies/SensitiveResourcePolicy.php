<?php

namespace App\Policies;

use App\Models\AuditLog;
use App\Models\Association;
use App\Models\Caisse;
use App\Models\EvenementSocial;
use App\Models\Membre;
use App\Models\Pret;
use App\Models\Reunion;
use App\Models\SanctionMembre;
use Illuminate\Contracts\Auth\Authenticatable;

class SensitiveResourcePolicy
{
    public function before(Authenticatable $user, string $ability): bool|null
    {
        return ($user->role ?? null) === 'super_admin' ? true : null;
    }

    public function viewAny(Authenticatable $user, mixed $model): bool
    {
        if ($this->isAuditLog($model)) {
            return in_array($user->role ?? null, ['super_admin', 'controleur'], true);
        }

        return $this->canManage($user);
    }

    public function view(Authenticatable $user, object $model): bool
    {
        if ($model instanceof Membre && ($user->role ?? null) === 'membre') {
            return $user->membre_id && $model->id === $user->membre_id;
        }

        return $this->ownsAssociation($user, $model) || $this->canManage($user);
    }

    public function create(Authenticatable $user, mixed $model): bool
    {
        return $this->canManage($user) || $this->isOwnProfileCreate($user, $model);
    }

    public function update(Authenticatable $user, object $model): bool
    {
        return $this->ownsAssociation($user, $model) || $this->ownsRecord($user, $model) || $this->canManage($user);
    }

    public function delete(Authenticatable $user, object $model): bool
    {
        return $this->canManage($user) || $this->ownsAssociation($user, $model);
    }

    private function canManage(Authenticatable $user): bool
    {
        return in_array($user->role ?? null, ['admin', 'president', 'tresorier', 'controleur', 'super_admin'], true);
    }

    private function ownsAssociation(Authenticatable $user, object $model): bool
    {
        $associationId = $user->membre?->association_id ?? $user->association_id ?? null;
        if (! $associationId || ! isset($model->association_id)) {
            return false;
        }
        return $associationId === $model->association_id;
    }

    private function ownsRecord(Authenticatable $user, object $model): bool
    {
        return ($model instanceof Membre && $user->membre_id && $model->id === $user->membre_id)
            || ($model instanceof AuditLog && in_array($user->role ?? null, ['controleur'], true));
    }

    private function isOwnProfileCreate(Authenticatable $user, mixed $model): bool
    {
        return $model === Membre::class && in_array($user->role ?? null, ['membre', 'president', 'tresorier'], true);
    }

    private function isAuditLog(mixed $model): bool
    {
        return $model === AuditLog::class;
    }
}
