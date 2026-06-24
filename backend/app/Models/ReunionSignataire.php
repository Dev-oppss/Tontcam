<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class ReunionSignataire extends Model
{
    use UsesUuid;

    protected $table = 'reunion_signataires';
}

