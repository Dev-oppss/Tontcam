<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;

class Reunion extends Model
{
    use UsesUuid, SoftDeletes;

    protected $table = 'reunions';

    protected $fillable = [
        'association_id',
        'numero',
        'type',
        'date_reunion',
        'heure_debut',
        'heure_fin_prevue',
        'heure_fin_reelle',
        'lieu',
        'est_domicile_membre',
        'hote_membre_id',
        'statut',
        'quorum_requis',
        'quorum_atteint',
        'notes',
        'created_by',
    ];

    protected $casts = [
            'date_reunion' => 'date',
            'est_domicile_membre' => 'boolean',
            'quorum_requis' => 'integer',
            'quorum_atteint' => 'boolean'
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }


    public function hote()
    {
        return $this->belongsTo(Membre::class, 'hote_membre_id');
    }


    public function createur()
    {
        return $this->belongsTo(Utilisateur::class, 'created_by');
    }


    public function signataires()
    {
        return $this->hasMany(ReunionSignataire::class);
    }


    public function ordreDuJour()
    {
        return $this->hasMany(OrdreDuJourItem::class)->orderBy('ordre');
    }


    public function presences()
    {
        return $this->hasMany(Presence::class);
    }


    public function cyclesTontine()
    {
        return $this->hasMany(CycleTontine::class);
    }


    public function decisionsAg()
    {
        return $this->hasMany(DecisionAg::class);
    }


    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    public function seanceTransactions()
    {
        return $this->hasMany(SeanceTransaction::class);
    }

}
