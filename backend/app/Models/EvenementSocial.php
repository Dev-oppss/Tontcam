<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EvenementSocial extends Model
{
    use UsesUuid;

    protected $table = 'evenements_sociaux';
    protected $casts = [
        'date_evenement' => 'date',
        'date_declaration' => 'date',
        'montant_demande' => 'decimal:2',
        'montant_accorde' => 'decimal:2',
        'pieces_jointes' => 'array',
        'approuve_at' => 'datetime',
        'date_versement' => 'datetime',
    ];

    public function association(): BelongsTo { return $this->belongsTo(Association::class); }
    public function membre(): BelongsTo { return $this->belongsTo(Membre::class); }
    public function typeAide(): BelongsTo { return $this->belongsTo(TypeAideSociale::class, 'type_aide_id'); }
    public function transaction(): BelongsTo { return $this->belongsTo(Transaction::class); }
}

