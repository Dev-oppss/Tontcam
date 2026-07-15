<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class TontinePart extends Model
{
    use UsesUuid;

    protected $table = 'tontine_parts';

    protected $fillable = [
        'tontine_id',
        'membre_id',
        'numero_part',
        'ordre_rotation',
        'date_gain_calendrier',
        'statut',
        'avaliste_id',
        'date_attribution',
        'notes',
    ];

    protected $casts = [
            'date_gain_calendrier' => 'date',
            'date_attribution' => 'datetime',
            'numero_part' => 'integer',
            'ordre_rotation' => 'integer'
    ];

    public function tontine()
    {
        return $this->belongsTo(Tontine::class);
    }


    public function membre()
    {
        return $this->belongsTo(Membre::class);
    }


    public function avaliste()
    {
        return $this->belongsTo(Membre::class, 'avaliste_id');
    }


    public function cotisations()
    {
        return $this->hasMany(CotisationTontine::class);
    }


    public function encherites()
    {
        return $this->hasMany(Encherite::class);
    }

}
