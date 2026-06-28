<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssuranceMembre extends Model
{
    use UsesUuid;

    protected $table = 'assurances_membres';
    protected $casts = [
        'date_debut' => 'date',
        'date_fin' => 'date',
        'prime_mensuelle' => 'decimal:2',
        'actif' => 'boolean',
    ];

    public function membre(): BelongsTo { return $this->belongsTo(Membre::class); }
    public function caisse(): BelongsTo { return $this->belongsTo(Caisse::class); }
}

