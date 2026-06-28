<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MembrePoste extends Model
{
    use UsesUuid;

    protected $table = 'membre_postes';
    protected $casts = [
        'date_debut' => 'date',
        'date_fin' => 'date',
        'est_actif' => 'boolean',
    ];

    public function membre(): BelongsTo { return $this->belongsTo(Membre::class); }
    public function poste(): BelongsTo { return $this->belongsTo(Poste::class); }
}

