<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class OrdreDuJourRubrique extends Model
{
    const UPDATED_AT = null;

    use UsesUuid;

    protected $table = 'ordre_du_jour_rubriques';

    protected $fillable = [
        'association_id',
        'libelle',
        'ordre_defaut',
        'est_obligatoire',
        'est_systeme',
        'actif',
    ];

    protected $casts = [
            'est_obligatoire' => 'boolean',
            'est_systeme' => 'boolean',
            'actif' => 'boolean',
            'ordre_defaut' => 'integer'
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }


    public function items()
    {
        return $this->hasMany(OrdreDuJourItem::class, 'rubrique_id');
    }

}
