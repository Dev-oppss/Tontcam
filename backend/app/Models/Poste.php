<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Poste extends Model
{
    use UsesUuid;

    protected $table = 'postes';
    protected $casts = [
        'niveau_hierarchie' => 'integer',
        'est_bureau' => 'boolean',
        'est_obligatoire' => 'boolean',
        'actif' => 'boolean',
    ];

    public function association(): BelongsTo { return $this->belongsTo(Association::class); }
    public function membres(): HasMany { return $this->hasMany(MembrePoste::class); }
}

