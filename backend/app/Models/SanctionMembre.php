<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class SanctionMembre extends Model
{
    use UsesUuid;

    protected $table = 'sanctions_membres';
}

