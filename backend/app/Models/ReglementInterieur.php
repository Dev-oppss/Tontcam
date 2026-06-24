<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class ReglementInterieur extends Model
{
    use UsesUuid;

    protected $table = 'reglement_interieur';
}

