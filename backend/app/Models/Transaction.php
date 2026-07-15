<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class Transaction extends Model
{
    const UPDATED_AT = null;

    use UsesUuid;

    protected $table = 'transactions';

    protected $fillable = [
        'caisse_id',
        'type',
        'montant',
        'solde_avant',
        'solde_apres',
        'libelle',
        'date_transaction',
        'mode_paiement',
        'cheque_numero',
        'reference_externe',
        'reference_type',
        'reference_id',
        'valide',
        'valide_par',
        'valide_at',
        'annulee',
        'annulee_par',
        'annulee_at',
        'motif_annulation',
        'notes',
        'created_by',
    ];

    protected $casts = [
            'montant' => 'decimal:2',
            'solde_avant' => 'decimal:2',
            'solde_apres' => 'decimal:2',
            'date_transaction' => 'datetime',
            'valide' => 'boolean',
            'valide_at' => 'datetime',
            'annulee' => 'boolean',
            'annulee_at' => 'datetime'
    ];

    public function caisse()
    {
        return $this->belongsTo(Caisse::class);
    }


    public function valideur()
    {
        return $this->belongsTo(Utilisateur::class, 'valide_par');
    }


    public function annuleur()
    {
        return $this->belongsTo(Utilisateur::class, 'annulee_par');
    }


    public function createur()
    {
        return $this->belongsTo(Utilisateur::class, 'created_by');
    }

}
