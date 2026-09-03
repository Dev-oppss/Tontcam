<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class AideSocialeInitiale extends Model
{
    use UsesUuid;

    public $timestamps = false;

    protected $table = 'aide_sociale_initiale';

    protected $fillable = ['membre_id', 'type_aide_id', 'nombre_deja_recu'];

    protected $casts = ['nombre_deja_recu' => 'integer', 'updated_at' => 'datetime'];
}
