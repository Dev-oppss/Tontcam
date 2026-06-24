<?php

namespace App\Services;

class TontineCycleService
{
    public function ouvrirCycle(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }

    public function saisirCotisations(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }

    public function cloturerCycle(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }

    public function designerGagnant(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }
}

