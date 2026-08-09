<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class CotisationTontine extends Model
{
    use UsesUuid;

    protected $table = 'cotisations_tontine';

    protected $fillable = [
        'cycle_id',
        'tontine_part_id',
        'membre_id',
        'montant_du',
        'montant_verse',
        'statut',
        'date_versement',
        'mode_paiement',
        'reference_paiement',
        'saisie_par',
        'notes',
    ];

    protected $casts = [
            'montant_du' => 'decimal:2',
            'montant_verse' => 'decimal:2',
            'date_versement' => 'datetime'
    ];

    public function cycle()
    {
        return $this->belongsTo(CycleTontine::class, 'cycle_id');
    }


    public function part()
    {
        return $this->belongsTo(TontinePart::class, 'tontine_part_id');
    }


    public function membre()
    {
        return $this->belongsTo(Membre::class);
    }


    public function saisiPar()
    {
        return $this->belongsTo(Utilisateur::class, 'saisie_par');
    }

}
