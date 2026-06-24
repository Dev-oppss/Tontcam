<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class Membre extends Model
{
    use UsesUuid;

    protected $table = 'membres';
}

