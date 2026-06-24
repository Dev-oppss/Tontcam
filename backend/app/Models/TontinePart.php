<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class TontinePart extends Model
{
    use UsesUuid;

    protected $table = 'tontine_parts';
}

