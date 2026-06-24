<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class Poste extends Model
{
    use UsesUuid;

    protected $table = 'postes';
}

