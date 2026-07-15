<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class TransfertCaisse extends Model
{
    const UPDATED_AT = null;

    use UsesUuid;

    protected $table = 'transferts_caisse';

    protected $fillable = [
        'caisse_source_id',
        'caisse_destination_id',
        'montant',
        'transaction_source_id',
        'transaction_dest_id',
        'motif',
        'approuve_par',
    ];

    protected $casts = [
            'montant' => 'decimal:2'
    ];

    public function caisseSource()
    {
        return $this->belongsTo(Caisse::class, 'caisse_source_id');
    }


    public function caisseDestination()
    {
        return $this->belongsTo(Caisse::class, 'caisse_destination_id');
    }


    public function transactionSource()
    {
        return $this->belongsTo(Transaction::class, 'transaction_source_id');
    }


    public function transactionDestination()
    {
        return $this->belongsTo(Transaction::class, 'transaction_dest_id');
    }


    public function approbateur()
    {
        return $this->belongsTo(Utilisateur::class, 'approuve_par');
    }

}
