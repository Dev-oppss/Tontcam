<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class CycleTontine extends Model
{
    use UsesUuid;

    protected $table = 'cycles_tontine';
}

