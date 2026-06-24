<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class TransfertCaisse extends Model
{
    use UsesUuid;

    protected $table = 'transferts_caisse';
}

