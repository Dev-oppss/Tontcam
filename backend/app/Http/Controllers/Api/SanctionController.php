<?php

namespace App\Http\Controllers\Api;

use App\Models\SanctionMembre;

class SanctionController extends CrudController
{
    protected string $model = SanctionMembre::class;
}

