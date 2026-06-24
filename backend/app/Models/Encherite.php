<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class Encherite extends Model
{
    use UsesUuid;

    protected $table = 'encherites';
}

