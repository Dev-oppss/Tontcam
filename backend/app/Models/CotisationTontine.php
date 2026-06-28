<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CotisationTontine extends Model
{
    use UsesUuid;

    protected $table = 'cotisations_tontine';
    protected $casts = ['montant_du' => 'decimal:2', 'montant_verse' => 'decimal:2', 'date_versement' => 'datetime'];

    public function cycle(): BelongsTo { return $this->belongsTo(CycleTontine::class, 'cycle_id'); }
    public function part(): BelongsTo { return $this->belongsTo(TontinePart::class, 'tontine_part_id'); }
    public function membre(): BelongsTo { return $this->belongsTo(Membre::class); }
}