<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transaction extends Model
{
    use UsesUuid;

    protected $table = 'transactions';
    public $timestamps = false;
    protected $casts = [
        'montant' => 'decimal:2',
        'solde_avant' => 'decimal:2',
        'solde_apres' => 'decimal:2',
        'date_transaction' => 'datetime',
        'valide' => 'boolean',
        'annulee' => 'boolean',
        'valide_at' => 'datetime',
        'annulee_at' => 'datetime',
    ];

    public function caisse(): BelongsTo { return $this->belongsTo(Caisse::class); }
    public function createdBy(): BelongsTo { return $this->belongsTo(Utilisateur::class, 'created_by'); }
}
