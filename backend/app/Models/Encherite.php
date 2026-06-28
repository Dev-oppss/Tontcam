<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Encherite extends Model
{
    use UsesUuid;

    protected $table = 'encherites';
    public $timestamps = false;
    protected $casts = ['montant_offre' => 'decimal:2', 'est_gagnante' => 'boolean'];

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(CycleTontine::class, 'cycle_id');
    }

    public function tontinePart(): BelongsTo
    {
        return $this->belongsTo(TontinePart::class);
    }
}

