<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CompteBancaire extends Model
{
    use UsesUuid;

    protected $table = 'comptes_bancaires';
    protected $casts = [
        'solde_dernier_releve' => 'decimal:2',
        'date_dernier_releve' => 'date',
        'actif' => 'boolean',
        'notes' => 'array',
    ];

    public function association(): BelongsTo { return $this->belongsTo(Association::class); }
    public function rapprochements(): HasMany { return $this->hasMany(RapprochementBancaire::class); }
}

