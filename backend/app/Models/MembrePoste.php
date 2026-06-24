<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class MembrePoste extends Model
{
    use UsesUuid;

    protected $table = 'membre_postes';
}

