<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class EvenementSocial extends Model
{
    use UsesUuid;

    protected $table = 'evenements_sociaux';
}

