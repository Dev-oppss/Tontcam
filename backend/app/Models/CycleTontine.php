<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class CycleTontine extends Model
{
    use UsesUuid;

    protected $table = 'cycles_tontine';
    protected $casts = [
        'numero_cycle' => 'integer',
        'montant_collecte_prevu' => 'decimal:2',
        'montant_collecte_reel' => 'decimal:2',
        'montant_deficit' => 'decimal:2',
        'montant_enchere' => 'decimal:2',
        'surplus_enchere' => 'decimal:2',
        'surplus_redistribue' => 'decimal:2',
        'surplus_mis_en_caisse' => 'decimal:2',
        'date_ouverture' => 'datetime',
        'date_cloture' => 'datetime',
    ];

    public function tontine(): BelongsTo { return $this->belongsTo(Tontine::class); }
    public function reunion(): BelongsTo { return $this->belongsTo(Reunion::class); }
    public function gagnantPart(): BelongsTo { return $this->belongsTo(TontinePart::class, 'gagnant_part_id'); }
    public function cotisations(): HasMany { return $this->hasMany(CotisationTontine::class, 'cycle_id'); }
    public function bulletin(): HasOne { return $this->hasOne(BulletinGain::class, 'cycle_id'); }
    public function encherites(): HasMany { return $this->hasMany(Encherite::class, 'cycle_id'); }
}
