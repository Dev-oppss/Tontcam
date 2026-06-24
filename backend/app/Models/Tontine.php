<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class Tontine extends Model
{
    use UsesUuid;

    protected $table = 'tontines';
}

