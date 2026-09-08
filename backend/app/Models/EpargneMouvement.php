<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class EpargneMouvement extends Model
{
    use UsesUuid;

    public $timestamps = false;

    protected $table = 'epargne_mouvements';

    protected $fillable = ['caisse_id', 'membre_id', 'type', 'montant', 'pret_id', 'transaction_id', 'motif', 'created_by'];

    protected $casts = ['montant' => 'decimal:2', 'created_at' => 'datetime'];

    public function membre()
    {
        return $this->belongsTo(Membre::class);
    }
}
