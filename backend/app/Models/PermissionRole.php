<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class PermissionRole extends Model
{
    use UsesUuid;

    public $timestamps = false;

    protected $table = 'permissions_roles';

    protected $fillable = [
        'role',
        'module',
        'action',
        'autorise',
        'conditions',
    ];

    protected $casts = [
            'autorise' => 'boolean',
            'conditions' => 'array'
    ];

}
