<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use UsesUuid;

    protected $table = 'notifications';
}

