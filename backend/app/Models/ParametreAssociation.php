<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class ParametreAssociation extends Model
{
    use UsesUuid;

    protected $table = 'parametres_association';
}

