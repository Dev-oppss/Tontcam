<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TypeSanction extends Model
{
    use UsesUuid;

    protected $table = 'types_sanction';
    protected $casts = [
        'montant_fixe' => 'decimal:2',
        'montant_pct' => 'decimal:4',
        'montant_journalier' => 'decimal:2',
        'est_automatique' => 'boolean',
        'actif' => 'boolean',
    ];

    public function association(): BelongsTo
    {
        return $this->belongsTo(Association::class);
    }
}

