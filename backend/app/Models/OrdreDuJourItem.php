<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class OrdreDuJourItem extends Model
{
    use UsesUuid;

    protected $table = 'ordre_du_jour_items';
}

