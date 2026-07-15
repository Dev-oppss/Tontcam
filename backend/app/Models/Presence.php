<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class Presence extends Model
{
    use UsesUuid;

    protected $table = 'presences';

    protected $fillable = [
        'reunion_id',
        'membre_id',
        'statut',
        'heure_arrivee',
        'motif_absence',
        'saisie_par',
    ];

    public function reunion()
    {
        return $this->belongsTo(Reunion::class);
    }


    public function membre()
    {
        return $this->belongsTo(Membre::class);
    }


    public function saisiPar()
    {
        return $this->belongsTo(Utilisateur::class, 'saisie_par');
    }

}
