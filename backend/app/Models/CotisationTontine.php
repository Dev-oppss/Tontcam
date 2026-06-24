<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class CotisationTontine extends Model
{
    use UsesUuid;

    protected $table = 'cotisations_tontine';
}

