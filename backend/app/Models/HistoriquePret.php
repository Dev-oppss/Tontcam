<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HistoriquePret extends Model
{
    use UsesUuid;

    protected $table = 'historique_prets';
    public $timestamps = false;
    protected $casts = ['created_at' => 'datetime'];

    public function pret(): BelongsTo { return $this->belongsTo(Pret::class); }
    public function faitPar(): BelongsTo { return $this->belongsTo(Utilisateur::class, 'fait_par'); }
}

