<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class TypeAideSociale extends Model
{
    use UsesUuid;

    protected $table = 'types_aide_sociale';

    protected $fillable = [
        'association_id',
        'libelle',
        'type_evenement',
        'montant_fixe',
        'montant_min',
        'montant_max',
        'conditions',
        'delai_versement_jours',
        'caisse_source_id',
        'nb_max_par_an',
        'nb_max_vie',
        'justificatif_requis',
        'actif',
        'date_effet',
    ];

    protected $casts = [
            'montant_fixe' => 'decimal:2',
            'montant_min' => 'decimal:2',
            'montant_max' => 'decimal:2',
            'delai_versement_jours' => 'integer',
            'nb_max_par_an' => 'integer',
            'nb_max_vie' => 'integer',
            'justificatif_requis' => 'boolean',
            'actif' => 'boolean',
            'date_effet' => 'date'
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }


    public function caisseSource()
    {
        return $this->belongsTo(Caisse::class, 'caisse_source_id');
    }


    public function evenements()
    {
        return $this->hasMany(EvenementSocial::class, 'type_aide_id');
    }

}
