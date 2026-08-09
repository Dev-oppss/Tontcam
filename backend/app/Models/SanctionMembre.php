<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class SanctionMembre extends Model
{
    use UsesUuid;

    protected $table = 'sanctions_membres';

    protected $fillable = [
        'association_id',
        'membre_id',
        'type_sanction_id',
        'reunion_id',
        'montant',
        'motif',
        'statut',
        'est_automatique',
        'reference_type',
        'reference_id',
        'appliquee_par',
        'annulee_par',
        'annulee_at',
        'motif_annulation',
        'payee_at',
        'transaction_id',
        'bulletin_id',
    ];

    protected $casts = [
            'montant' => 'decimal:2',
            'est_automatique' => 'boolean',
            'annulee_at' => 'datetime',
            'payee_at' => 'datetime'
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }


    public function membre()
    {
        return $this->belongsTo(Membre::class);
    }


    public function type()
    {
        return $this->belongsTo(TypeSanction::class, 'type_sanction_id');
    }


    public function reunion()
    {
        return $this->belongsTo(Reunion::class);
    }


    public function appliquePar()
    {
        return $this->belongsTo(Utilisateur::class, 'appliquee_par');
    }


    public function annulePar()
    {
        return $this->belongsTo(Utilisateur::class, 'annulee_par');
    }


    public function transaction()
    {
        return $this->belongsTo(Transaction::class);
    }


    public function bulletin()
    {
        return $this->belongsTo(BulletinGain::class, 'bulletin_id');
    }

}
