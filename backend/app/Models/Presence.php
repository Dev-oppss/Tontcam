<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Presence extends Model
{
    use UsesUuid;

    protected $table = 'presences';
    protected $casts = ['heure_arrivee' => 'datetime:H:i:s'];

    public function reunion(): BelongsTo { return $this->belongsTo(Reunion::class); }
    public function membre(): BelongsTo { return $this->belongsTo(Membre::class); }
    public function saisiePar(): BelongsTo { return $this->belongsTo(Utilisateur::class, 'saisie_par'); }
}
