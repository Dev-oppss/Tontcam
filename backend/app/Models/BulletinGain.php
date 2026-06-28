<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BulletinGain extends Model
{
    use UsesUuid;

    protected $table = 'bulletins_gain';
    protected $casts = [
        'montant_brut' => 'decimal:2',
        'total_retenues' => 'decimal:2',
        'montant_net' => 'decimal:2',
        'date_versement' => 'datetime',
        'signe_tresorier_at' => 'datetime',
        'signe_president_at' => 'datetime',
        'signe_beneficiaire_at' => 'datetime',
    ];

    public function cycle(): BelongsTo { return $this->belongsTo(CycleTontine::class, 'cycle_id'); }
    public function retenues(): HasMany { return $this->hasMany(RetenueBulletin::class, 'bulletin_id'); }
}
