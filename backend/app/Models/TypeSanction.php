<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class TypeSanction extends Model
{
    use UsesUuid;

    protected $table = 'types_sanction';
}

