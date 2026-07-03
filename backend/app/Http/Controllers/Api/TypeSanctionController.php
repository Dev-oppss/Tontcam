<?php

namespace App\Http\Controllers\Api;

use App\Models\TypeSanction;

class TypeSanctionController extends CrudController
{
    protected string $model = TypeSanction::class;
    protected array $filterable = ['association_id', 'actif', 'declencheur'];
}
