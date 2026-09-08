<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class PretEpargneSnapshot extends Model
{
    use UsesUuid;

    public $timestamps = false;

    protected $table = 'pret_epargne_snapshots';

    protected $fillable = ['pret_id', 'membre_id', 'solde_snapshot'];

    protected $casts = ['solde_snapshot' => 'decimal:2'];
}
