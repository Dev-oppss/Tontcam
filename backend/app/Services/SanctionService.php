<?php

namespace App\Services;

class SanctionService
{
    public function appliquerManuelle(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }

    public function absenceNonExcusee(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }

    public function retardCotisation(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }

    public function retardPret(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }
}

