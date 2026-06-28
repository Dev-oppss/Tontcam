<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ParametreAssociation extends Model
{
    use UsesUuid;

    protected $table = 'parametres_association';
    public $timestamps = false;
    protected $casts = ['valeur_json' => 'array', 'modifiable' => 'boolean', 'updated_at' => 'datetime'];

    public function association(): BelongsTo { return $this->belongsTo(Association::class); }
    public function updatedBy(): BelongsTo { return $this->belongsTo(Utilisateur::class, 'updated_by'); }
}

