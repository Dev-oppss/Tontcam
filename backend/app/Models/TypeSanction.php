<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class TypeSanction extends Model
{
    use UsesUuid;

    protected $table = 'types_sanction';

    protected $fillable = [
        'association_id',
        'libelle',
        'mode_calcul',
        'montant_fixe',
        'montant_pct',
        'montant_journalier',
        'est_automatique',
        'declencheur',
        'paliers_retard',
        'paliers_absence',
        'actif',
        'description',
    ];

    protected $casts = [
            'montant_fixe' => 'decimal:2',
            'montant_pct' => 'decimal:4',
            'montant_journalier' => 'decimal:2',
            'est_automatique' => 'boolean',
            'paliers_retard' => 'array',
            'paliers_absence' => 'array',
            'actif' => 'boolean'
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }


    public function sanctions()
    {
        return $this->hasMany(SanctionMembre::class, 'type_sanction_id');
    }

}
