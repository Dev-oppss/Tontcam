<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;

class Membre extends Model
{
    use UsesUuid, SoftDeletes;

    protected $table = 'membres';

    protected $fillable = [
        'association_id',
        'matricule',
        'nom',
        'prenom',
        'date_naissance',
        'sexe',
        'telephone',
        'telephone2',
        'email',
        'adresse',
        'ville',
        'profession',
        'photo_url',
        'date_adhesion',
        'statut',
        'motif_suspension',
        'motif_exclusion',
        'est_assure',
        'date_debut_assurance',
        'date_fin_assurance',
        'notes',
    ];

    protected $casts = [
            'date_naissance' => 'date',
            'date_adhesion' => 'date',
            'est_assure' => 'boolean',
            'date_debut_assurance' => 'date',
            'date_fin_assurance' => 'date'
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }


    public function utilisateur()
    {
        return $this->hasOne(Utilisateur::class, 'membre_id');
    }


    public function mandats()
    {
        return $this->hasMany(MembrePoste::class);
    }


    public function parts()
    {
        return $this->hasMany(TontinePart::class);
    }


    public function prets()
    {
        return $this->hasMany(Pret::class, 'emprunteur_id');
    }


    public function pretsAvalises()
    {
        return $this->hasMany(Pret::class, 'avaliste_id');
    }


    public function sanctions()
    {
        return $this->hasMany(SanctionMembre::class);
    }


    public function presences()
    {
        return $this->hasMany(Presence::class);
    }


    public function assurances()
    {
        return $this->hasMany(AssuranceMembre::class);
    }


    public function evenementsSociaux()
    {
        return $this->hasMany(EvenementSocial::class);
    }

}
