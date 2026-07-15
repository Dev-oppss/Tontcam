<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class CycleTontine extends Model
{
    use UsesUuid;

    protected $table = 'cycles_tontine';

    protected $fillable = [
        'tontine_id',
        'reunion_id',
        'numero_cycle',
        'statut',
        'montant_collecte_prevu',
        'montant_collecte_reel',
        'gagnant_part_id',
        'montant_enchere',
        'surplus_enchere',
        'surplus_redistribue',
        'surplus_mis_en_caisse',
        'date_ouverture',
        'date_cloture',
        'notes',
    ];

    protected $casts = [
            'montant_collecte_prevu' => 'decimal:2',
            'montant_collecte_reel' => 'decimal:2',
            'montant_enchere' => 'decimal:2',
            'surplus_enchere' => 'decimal:2',
            'surplus_redistribue' => 'decimal:2',
            'surplus_mis_en_caisse' => 'decimal:2',
            'date_ouverture' => 'datetime',
            'date_cloture' => 'datetime',
            'numero_cycle' => 'integer'
    ];

    public function tontine()
    {
        return $this->belongsTo(Tontine::class);
    }


    public function reunion()
    {
        return $this->belongsTo(Reunion::class);
    }


    public function gagnant()
    {
        return $this->belongsTo(TontinePart::class, 'gagnant_part_id');
    }


    public function cotisations()
    {
        return $this->hasMany(CotisationTontine::class, 'cycle_id');
    }


    public function encherites()
    {
        return $this->hasMany(Encherite::class, 'cycle_id');
    }


    public function bulletin()
    {
        return $this->hasOne(BulletinGain::class, 'cycle_id');
    }

}
