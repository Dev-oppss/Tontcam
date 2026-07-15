<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class RapprochementBancaire extends Model
{
    const UPDATED_AT = null;

    use UsesUuid;

    protected $table = 'rapprochements_bancaires';

    protected $fillable = [
        'compte_bancaire_id',
        'caisse_id',
        'periode_debut',
        'periode_fin',
        'solde_banque',
        'solde_logiciel',
        'justification',
        'valide_par',
        'valide_at',
    ];

    protected $casts = [
            'periode_debut' => 'date',
            'periode_fin' => 'date',
            'solde_banque' => 'decimal:2',
            'solde_logiciel' => 'decimal:2',
            'valide_at' => 'datetime'
    ];

    public function compteBancaire()
    {
        return $this->belongsTo(CompteBancaire::class);
    }


    public function caisse()
    {
        return $this->belongsTo(Caisse::class);
    }


    public function validateur()
    {
        return $this->belongsTo(Utilisateur::class, 'valide_par');
    }

}
