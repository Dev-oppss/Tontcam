<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class RetenueBulletin extends Model
{
    use UsesUuid;

    protected $table = 'retenues_bulletin';
}

