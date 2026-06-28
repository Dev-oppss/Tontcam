<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $table = 'audit_log';
    public $timestamps = false;
    protected $primaryKey = 'id';
    protected $keyType = 'int';
    public $incrementing = true;
    protected $guarded = [];
    protected $casts = [
        'valeur_avant' => 'array',
        'valeur_apres' => 'array',
        'created_at' => 'datetime',
    ];

    public function association(): BelongsTo { return $this->belongsTo(Association::class); }
    public function utilisateur(): BelongsTo { return $this->belongsTo(Utilisateur::class); }
}

