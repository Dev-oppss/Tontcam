<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class EcheancePret extends Model
{
    use UsesUuid;

    protected $table = 'echeances_pret';

    protected $fillable = [
        'pret_id',
        'numero_echeance',
        'date_echeance',
        'montant_capital',
        'montant_interet',
        'montant_total',
        'montant_verse',
        'montant_penalite',
        'capital_restant_apres',
        'statut',
        'date_versement_reel',
        'transaction_id',
        'notes',
    ];

    protected $casts = [
            'date_echeance' => 'date',
            'montant_capital' => 'decimal:2',
            'montant_interet' => 'decimal:2',
            'montant_total' => 'decimal:2',
            'montant_verse' => 'decimal:2',
            'montant_penalite' => 'decimal:2',
            'capital_restant_apres' => 'decimal:2',
            'date_versement_reel' => 'date',
            'numero_echeance' => 'integer'
    ];

    public function pret()
    {
        return $this->belongsTo(Pret::class, 'pret_id');
    }


    public function transaction()
    {
        return $this->belongsTo(Transaction::class);
    }

}
