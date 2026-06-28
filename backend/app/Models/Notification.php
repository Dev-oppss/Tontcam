<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notification extends Model
{
    use UsesUuid;

    protected $table = 'notifications';
    public $timestamps = false;
    protected $casts = [
        'programmee_a' => 'datetime',
        'envoyee_a' => 'datetime',
        'nb_tentatives' => 'integer',
    ];

    public function association(): BelongsTo { return $this->belongsTo(Association::class); }
    public function reunion(): BelongsTo { return $this->belongsTo(Reunion::class); }
    public function membre(): BelongsTo { return $this->belongsTo(Membre::class); }
}

