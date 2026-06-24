<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class Association extends Model
{
    use UsesUuid;

    protected $table = 'associations';
}

