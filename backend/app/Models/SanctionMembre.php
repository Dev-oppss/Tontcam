<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SanctionMembre extends Model
{
    use UsesUuid;

    protected $table = 'sanctions_membres';
    protected $casts = [
        'montant' => 'decimal:2',
        'est_automatique' => 'boolean',
        'payee_at' => 'datetime',
        'annulee_at' => 'datetime',
    ];

    public function association(): BelongsTo { return $this->belongsTo(Association::class); }
    public function membre(): BelongsTo { return $this->belongsTo(Membre::class); }
    public function typeSanction(): BelongsTo { return $this->belongsTo(TypeSanction::class); }
    public function transaction(): BelongsTo { return $this->belongsTo(Transaction::class); }
    public function bulletin(): BelongsTo { return $this->belongsTo(BulletinGain::class, 'bulletin_id'); }
}
