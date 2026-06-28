<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RetenueBulletin extends Model
{
    use UsesUuid;

    protected $table = 'retenues_bulletin';
    public $timestamps = false;
    protected $casts = ['montant' => 'decimal:2', 'priorite' => 'integer'];

    public function bulletin(): BelongsTo
    {
        return $this->belongsTo(BulletinGain::class, 'bulletin_id');
    }
}

