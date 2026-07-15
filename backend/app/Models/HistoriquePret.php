<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class HistoriquePret extends Model
{
    const UPDATED_AT = null;

    use UsesUuid;

    protected $table = 'historique_prets';

    protected $fillable = [
        'pret_id',
        'statut_avant',
        'statut_apres',
        'commentaire',
        'fait_par',
    ];

    public function pret()
    {
        return $this->belongsTo(Pret::class, 'pret_id');
    }


    public function auteur()
    {
        return $this->belongsTo(Utilisateur::class, 'fait_par');
    }

}
