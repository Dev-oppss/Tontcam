<?php

namespace App\Http\Controllers\Api;

use App\Models\Association;

class AssociationController extends CrudController
{
    protected string $model = Association::class;
}

