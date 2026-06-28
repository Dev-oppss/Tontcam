<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DecisionAg extends Model
{
    use UsesUuid;

    protected $table = 'decisions_ag';
    protected $casts = [
        'quorum_present' => 'integer',
        'votes_pour' => 'integer',
        'votes_contre' => 'integer',
        'votes_abstention' => 'integer',
        'date_effet' => 'date',
    ];

    public function association(): BelongsTo { return $this->belongsTo(Association::class); }
    public function reunion(): BelongsTo { return $this->belongsTo(Reunion::class); }
}

