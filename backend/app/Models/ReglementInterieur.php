<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class ReglementInterieur extends Model
{
    const UPDATED_AT = null;

    use UsesUuid;

    protected $table = 'reglement_interieur';

    protected $fillable = [
        'association_id',
        'version',
        'titre',
        'contenu_html',
        'fichier_url',
        'date_adoption',
        'est_actif',
        'signataires',
    ];

    protected $casts = [
            'date_adoption' => 'date',
            'est_actif' => 'boolean',
            'signataires' => 'array'
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }

}
