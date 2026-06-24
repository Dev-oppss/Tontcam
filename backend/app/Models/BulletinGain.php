<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class BulletinGain extends Model
{
    use UsesUuid;

    protected $table = 'bulletins_gain';
}

