<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Reunion extends Model
{
    use UsesUuid;

    protected $table = 'reunions';
    protected $casts = [
        'numero' => 'integer',
        'date_reunion' => 'date',
        'heure_debut' => 'datetime:H:i:s',
        'heure_fin_prevue' => 'datetime:H:i:s',
        'heure_fin_reelle' => 'datetime:H:i:s',
        'est_domicile_membre' => 'boolean',
        'quorum_requis' => 'integer',
        'quorum_atteint' => 'boolean',
    ];

    public function association(): BelongsTo { return $this->belongsTo(Association::class); }
    public function presences(): HasMany { return $this->hasMany(Presence::class); }
    public function signataires(): HasMany { return $this->hasMany(ReunionSignataire::class); }
    public function ordreDuJourItems(): HasMany { return $this->hasMany(OrdreDuJourItem::class); }
}
