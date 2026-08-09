<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class Encherite extends Model
{
    const UPDATED_AT = null;

    use UsesUuid;

    protected $table = 'encherites';

    protected $fillable = [
        'cycle_id',
        'tontine_part_id',
        'membre_id',
        'montant_offre',
        'caisse_id',
        'est_gagnante',
    ];

    protected $casts = [
            'montant_offre' => 'decimal:2',
            'est_gagnante' => 'boolean'
    ];

    public function cycle()
    {
        return $this->belongsTo(CycleTontine::class, 'cycle_id');
    }


    public function part()
    {
        return $this->belongsTo(TontinePart::class, 'tontine_part_id');
    }


    public function membre()
    {
        return $this->belongsTo(Membre::class);
    }

    public function caisse()
    {
        return $this->belongsTo(Caisse::class);
    }

}
