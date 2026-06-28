<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsTo as RelationBelongsTo;

class TypeAideSociale extends Model
{
    use UsesUuid;

    protected $table = 'types_aide_sociale';
    protected $casts = [
        'montant_fixe' => 'decimal:2',
        'montant_min' => 'decimal:2',
        'montant_max' => 'decimal:2',
        'delai_versement_jours' => 'integer',
        'nb_max_par_an' => 'integer',
        'justificatif_requis' => 'boolean',
        'actif' => 'boolean',
        'date_effet' => 'date',
    ];

    public function association(): RelationBelongsTo
    {
        return $this->belongsTo(Association::class);
    }

    public function caisseSource(): RelationBelongsTo
    {
        return $this->belongsTo(Caisse::class, 'caisse_source_id');
    }
}

