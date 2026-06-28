<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TontinePart extends Model
{
    use UsesUuid;

    protected $table = 'tontine_parts';
    protected $casts = [
        'numero_part' => 'integer',
        'ordre_rotation' => 'integer',
        'date_gain_calendrier' => 'date',
        'date_attribution' => 'datetime',
    ];

    public function tontine(): BelongsTo { return $this->belongsTo(Tontine::class); }
    public function membre(): BelongsTo { return $this->belongsTo(Membre::class); }
    public function cotisations(): HasMany { return $this->hasMany(CotisationTontine::class); }
}
