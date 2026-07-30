<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;

class Tontine extends Model
{
    use UsesUuid, SoftDeletes;

    protected $table = 'tontines';

    protected $fillable = [
        'association_id',
        'libelle',
        'description',
        'montant_part',
        'mode_attribution',
        'nb_parts_total',
        'max_cycles_par_reunion',
        'nb_cycles_realises',
        'exige_avaliste',
        'pret_autorise',
        'taux_interet_pret',
        'duree_max_pret_mois',
        'option_surplus',
        'mise_min_enchere',
        'statut',
        'date_debut',
        'date_fin_prevue',
        'date_cloture',
        'caisse_id',
        'config',
        'created_by',
    ];

    protected $casts = [
            'montant_part' => 'decimal:2',
            'exige_avaliste' => 'boolean',
            'pret_autorise' => 'boolean',
            'nb_parts_total' => 'integer',
            'max_cycles_par_reunion' => 'integer',
            'nb_cycles_realises' => 'integer',
            'taux_interet_pret' => 'decimal:4',
            'duree_max_pret_mois' => 'integer',
            'mise_min_enchere' => 'decimal:2',
            'date_debut' => 'date',
            'date_fin_prevue' => 'date',
            'date_cloture' => 'date',
            'config' => 'array'
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }


    public function caisse()
    {
        return $this->belongsTo(Caisse::class);
    }


    public function parts()
    {
        return $this->hasMany(TontinePart::class);
    }


    public function cycles()
    {
        return $this->hasMany(CycleTontine::class);
    }


    public function createur()
    {
        return $this->belongsTo(Utilisateur::class, 'created_by');
    }

    public function planningTours()
    {
        return $this->hasMany(PlanningTour::class);
    }

}
