<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReglementInterieur extends Model
{
    use UsesUuid;

    protected $table = 'reglement_interieur';
    public $timestamps = false;
    protected $casts = [
        'date_adoption' => 'date',
        'est_actif' => 'boolean',
        'signataires' => 'array',
    ];

    public function association(): BelongsTo { return $this->belongsTo(Association::class); }
}

