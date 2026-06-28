<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReunionSignataire extends Model
{
    use UsesUuid;

    protected $table = 'reunion_signataires';
    public $timestamps = false;
    protected $casts = ['ordre_signature' => 'integer', 'signed_at' => 'datetime'];

    public function reunion(): BelongsTo { return $this->belongsTo(Reunion::class); }
    public function membre(): BelongsTo { return $this->belongsTo(Membre::class); }
}
