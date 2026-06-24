<?php

namespace App\Http\Controllers\Api;

use App\Models\Membre;

class MembreController extends CrudController
{
    protected string $model = Membre::class;
}

