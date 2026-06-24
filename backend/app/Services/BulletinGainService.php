<?php

namespace App\Services;

class BulletinGainService
{
    public function calculerBrut(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }

    public function calculerRetenues(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }

    public function calculerNet(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }

    public function genererPdf(...$args): array
    {
        return ['service' => self::class, 'action' => __FUNCTION__, 'args' => $args];
    }
}

