<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EcheancePret extends Model
{
    use UsesUuid;

    protected $table = 'echeances_pret';
    protected $casts = [
        'numero_echeance' => 'integer',
        'date_echeance' => 'date',
        'montant_capital' => 'decimal:2',
        'montant_interet' => 'decimal:2',
        'montant_total' => 'decimal:2',
        'montant_verse' => 'decimal:2',
        'montant_penalite' => 'decimal:2',
        'capital_restant_apres' => 'decimal:2',
        'date_versement_reel' => 'date',
    ];

    public function pret(): BelongsTo
    {
        return $this->belongsTo(Pret::class);
    }
}

