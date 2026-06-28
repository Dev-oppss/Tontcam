<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TransfertCaisse extends Model
{
    use UsesUuid;

    protected $table = 'transferts_caisse';
    public $timestamps = false;
    protected $casts = ['montant' => 'decimal:2', 'created_at' => 'datetime'];

    public function caisseSource(): BelongsTo { return $this->belongsTo(Caisse::class, 'caisse_source_id'); }
    public function caisseDestination(): BelongsTo { return $this->belongsTo(Caisse::class, 'caisse_destination_id'); }
    public function transactionSource(): BelongsTo { return $this->belongsTo(Transaction::class, 'transaction_source_id'); }
    public function transactionDest(): BelongsTo { return $this->belongsTo(Transaction::class, 'transaction_dest_id'); }
    public function approuvePar(): BelongsTo { return $this->belongsTo(Utilisateur::class, 'approuve_par'); }
}

