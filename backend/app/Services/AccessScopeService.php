<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class AccessScopeService
{
    public function associationId(Request $request): ?string
    {
        return $request->user()?->membre?->association_id ?? $request->user()?->association_id ?? null;
    }

    public function scopeAssociation(Builder $query, ?string $associationId): Builder
    {
        return $associationId ? $query->where('association_id', $associationId) : $query;
    }

    public function scopeMembre(Builder $query, ?string $membreId, string $column = 'membre_id'): Builder
    {
        return $membreId ? $query->where($column, $membreId) : $query;
    }
}
