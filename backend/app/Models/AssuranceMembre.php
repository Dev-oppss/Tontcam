<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class AssuranceMembre extends Model
{
    use UsesUuid;

    protected $table = 'assurances_membres';
}

