<?php

namespace App\Services;

class AccessScopeService
{
    public function associationId(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }

    public function scopeAssociation(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }

    public function scopeMembre(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }
}

