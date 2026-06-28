<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Caisse extends Model
{
    use UsesUuid;

    protected $table = 'caisses';
    protected $casts = [
        'solde_initial' => 'decimal:2',
        'solde_actuel' => 'decimal:2',
        'taux_interet_mensuel' => 'decimal:4',
        'taux_penalite_mensuel' => 'decimal:4',
        'seuil_alerte_bas' => 'decimal:2',
        'config' => 'array',
        'actif' => 'boolean',
        'date_ouverture' => 'date',
        'date_cloture' => 'date',
    ];

    public function association(): BelongsTo { return $this->belongsTo(Association::class); }
    public function compteBancaire(): BelongsTo { return $this->belongsTo(CompteBancaire::class); }
    public function transactions(): HasMany { return $this->hasMany(Transaction::class); }
    public function tontine(): BelongsTo { return $this->belongsTo(Tontine::class); }
}
