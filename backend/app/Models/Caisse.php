<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class Caisse extends Model
{
    use UsesUuid;

    protected $table = 'caisses';
}

