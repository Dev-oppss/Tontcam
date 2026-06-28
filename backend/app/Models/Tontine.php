<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tontine extends Model
{
    use UsesUuid;

    protected $table = 'tontines';
    protected $casts = [
        'montant_part' => 'decimal:2',
        'nb_parts_total' => 'integer',
        'nb_cycles_realises' => 'integer',
        'exige_avaliste' => 'boolean',
        'pret_autorise' => 'boolean',
        'taux_interet_pret' => 'decimal:4',
        'duree_max_pret_mois' => 'integer',
        'option_surplus' => 'string',
        'mise_min_enchere' => 'decimal:2',
        'config' => 'array',
        'date_debut' => 'date',
        'date_fin_prevue' => 'date',
        'date_cloture' => 'date',
    ];

    public function association(): BelongsTo { return $this->belongsTo(Association::class); }
    public function caisse(): BelongsTo { return $this->belongsTo(Caisse::class); }
    public function parts(): HasMany { return $this->hasMany(TontinePart::class); }
    public function cycles(): HasMany { return $this->hasMany(CycleTontine::class); }
}
