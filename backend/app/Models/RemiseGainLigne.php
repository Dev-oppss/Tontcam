<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class RemiseGainLigne extends Model
{
    use UsesUuid;

    public $timestamps = false;

    protected $table = 'remise_gain_lignes';

    protected $fillable = ['remise_gain_id', 'tontine_part_id', 'montant_verse', 'notes'];

    protected $casts = ['montant_verse' => 'decimal:2', 'created_at' => 'datetime'];

    public function remise()
    {
        return $this->belongsTo(RemiseGain::class, 'remise_gain_id');
    }

    public function part()
    {
        return $this->belongsTo(TontinePart::class, 'tontine_part_id');
    }
}
