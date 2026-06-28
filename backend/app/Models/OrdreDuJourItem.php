<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrdreDuJourItem extends Model
{
    use UsesUuid;

    protected $table = 'ordre_du_jour_items';
    protected $casts = [
        'ordre' => 'integer',
        'pieces_jointes' => 'array',
        'rapport_valide' => 'boolean',
    ];

    public function reunion(): BelongsTo { return $this->belongsTo(Reunion::class); }
    public function rubrique(): BelongsTo { return $this->belongsTo(OrdreDuJourRubrique::class, 'rubrique_id'); }
    public function rapporteur(): BelongsTo { return $this->belongsTo(Membre::class, 'rapporteur_id'); }
}

