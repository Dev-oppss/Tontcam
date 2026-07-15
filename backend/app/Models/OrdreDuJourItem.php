<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class OrdreDuJourItem extends Model
{
    use UsesUuid;

    protected $table = 'ordre_du_jour_items';

    protected $fillable = [
        'reunion_id',
        'rubrique_id',
        'libelle_libre',
        'ordre',
        'rapporteur_id',
        'contenu_rapport',
        'rapport_valide',
        'pieces_jointes',
    ];

    protected $casts = [
            'rapport_valide' => 'boolean',
            'pieces_jointes' => 'array',
            'ordre' => 'integer'
    ];

    public function reunion()
    {
        return $this->belongsTo(Reunion::class);
    }


    public function rubrique()
    {
        return $this->belongsTo(OrdreDuJourRubrique::class, 'rubrique_id');
    }


    public function rapporteur()
    {
        return $this->belongsTo(Membre::class, 'rapporteur_id');
    }

}
