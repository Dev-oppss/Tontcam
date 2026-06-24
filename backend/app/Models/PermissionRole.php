<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class PermissionRole extends Model
{
    use UsesUuid;

    protected $table = 'permissions_roles';
}

