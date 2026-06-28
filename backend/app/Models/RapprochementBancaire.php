<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RapprochementBancaire extends Model
{
    use UsesUuid;

    protected $table = 'rapprochements_bancaires';
    public $timestamps = false;
    protected $casts = [
        'periode_debut' => 'date',
        'periode_fin' => 'date',
        'solde_banque' => 'decimal:2',
        'solde_logiciel' => 'decimal:2',
        'ecart' => 'decimal:2',
        'valide_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function compteBancaire(): BelongsTo { return $this->belongsTo(CompteBancaire::class); }
    public function caisse(): BelongsTo { return $this->belongsTo(Caisse::class); }
    public function validePar(): BelongsTo { return $this->belongsTo(Utilisateur::class, 'valide_par'); }
}

