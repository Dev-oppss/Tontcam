<?php

namespace App\Services;

class CaisseService
{
    public function entree(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }

    public function sortie(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }

    public function transfert(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }

    public function corriger(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }
}

