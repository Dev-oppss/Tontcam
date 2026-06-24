<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class HistoriquePret extends Model
{
    use UsesUuid;

    protected $table = 'historique_prets';
}

