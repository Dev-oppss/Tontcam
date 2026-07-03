<?php

namespace App\Http\Controllers\Api;

use App\Models\TypeAideSociale;

class TypeAideSocialeController extends CrudController
{
    protected string $model = TypeAideSociale::class;
    protected array $filterable = ['association_id', 'actif', 'type_evenement'];
}
