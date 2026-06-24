<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class RapprochementBancaire extends Model
{
    use UsesUuid;

    protected $table = 'rapprochements_bancaires';
}

