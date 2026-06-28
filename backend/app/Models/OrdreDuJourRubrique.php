<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrdreDuJourRubrique extends Model
{
    use UsesUuid;

    protected $table = 'ordre_du_jour_rubriques';
    protected $casts = [
        'ordre_defaut' => 'integer',
        'est_obligatoire' => 'boolean',
        'est_systeme' => 'boolean',
        'actif' => 'boolean',
    ];

    public function association(): BelongsTo { return $this->belongsTo(Association::class); }
}

