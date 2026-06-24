<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class CompteBancaire extends Model
{
    use UsesUuid;

    protected $table = 'comptes_bancaires';
}

