<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class RemiseGain extends Model
{
    use UsesUuid;

    protected $table = 'remises_gain';

    protected $fillable = ['tontine_id', 'reunion_id', 'date_remise', 'notes', 'created_by'];

    protected $casts = ['date_remise' => 'datetime'];

    public function tontine()
    {
        return $this->belongsTo(Tontine::class);
    }

    public function lignes()
    {
        return $this->hasMany(RemiseGainLigne::class);
    }
}
