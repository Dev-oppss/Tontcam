<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class Poste extends Model
{
    use UsesUuid;

    protected $table = 'postes';

    protected $fillable = [
        'association_id',
        'libelle',
        'code',
        'role_utilisateur',
        'niveau_hierarchie',
        'est_bureau',
        'est_obligatoire',
        'pouvoirs',
        'obligations',
        'actif',
    ];

    protected $casts = [
            'est_bureau' => 'boolean',
            'est_obligatoire' => 'boolean',
            'actif' => 'boolean',
            'niveau_hierarchie' => 'integer'
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }


    public function mandats()
    {
        return $this->hasMany(MembrePoste::class);
    }

}
