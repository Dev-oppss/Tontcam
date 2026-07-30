<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class RetenueBulletin extends Model
{
    const UPDATED_AT = null;

    use UsesUuid;

    protected $table = 'retenues_bulletin';

    protected $fillable = [
        'bulletin_id',
        'type_retenue',
        'libelle',
        'montant',
        'priorite',
        'reference_id',
        'reference_type',
        'caisse_id',
        'transaction_id',
    ];

    protected $casts = [
            'montant' => 'decimal:2',
            'priorite' => 'integer'
    ];

    public function bulletin()
    {
        return $this->belongsTo(BulletinGain::class, 'bulletin_id');
    }

    public function caisse()
    {
        return $this->belongsTo(Caisse::class);
    }

    public function transaction()
    {
        return $this->belongsTo(Transaction::class);
    }

}
