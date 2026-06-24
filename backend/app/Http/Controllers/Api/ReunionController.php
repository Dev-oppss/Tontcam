<?php

namespace App\Http\Controllers\Api;

use App\Models\Reunion;

class ReunionController extends CrudController
{
    protected string $model = Reunion::class;
}

