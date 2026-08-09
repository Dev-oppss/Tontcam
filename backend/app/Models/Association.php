<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;

class Association extends Model
{
    use UsesUuid, SoftDeletes;

    protected $table = 'associations';

    protected $fillable = [
        'nom',
        'nom_abrege',
        'siege_social',
        'ville',
        'pays',
        'telephone',
        'email',
        'date_creation',
        'devise',
        'logo_url',
        'statuts_url',
        'seuil_approbation_pret',
        'seuil_approbation_caisse',
        'nb_signataires_pv',
        'delai_rappel_j7',
        'delai_rappel_j3',
        'delai_rappel_j1',
        'config',
        'actif',
        'profil_complete',
    ];

    protected $casts = [
            'date_creation' => 'date',
            'seuil_approbation_pret' => 'decimal:2',
            'seuil_approbation_caisse' => 'decimal:2',
            'nb_signataires_pv' => 'integer',
            'delai_rappel_j7' => 'boolean',
            'delai_rappel_j3' => 'boolean',
            'delai_rappel_j1' => 'boolean',
            'config' => 'array',
            'actif' => 'boolean',
            'profil_complete' => 'boolean'
    ];

    public function membres()
    {
        return $this->hasMany(Membre::class);
    }


    public function postes()
    {
        return $this->hasMany(Poste::class);
    }


    public function reunions()
    {
        return $this->hasMany(Reunion::class);
    }


    public function tontines()
    {
        return $this->hasMany(Tontine::class);
    }


    public function caisses()
    {
        return $this->hasMany(Caisse::class);
    }


    public function comptesBancaires()
    {
        return $this->hasMany(CompteBancaire::class);
    }


    public function reglements()
    {
        return $this->hasMany(ReglementInterieur::class);
    }


    public function decisionsAg()
    {
        return $this->hasMany(DecisionAg::class);
    }


    public function typesSanction()
    {
        return $this->hasMany(TypeSanction::class);
    }


    public function sanctions()
    {
        return $this->hasMany(SanctionMembre::class);
    }


    public function typesAideSociale()
    {
        return $this->hasMany(TypeAideSociale::class);
    }


    public function evenementsSociaux()
    {
        return $this->hasMany(EvenementSocial::class);
    }


    public function parametres()
    {
        return $this->hasMany(ParametreAssociation::class);
    }


    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class);
    }


    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }


    public function ordreDuJourRubriques()
    {
        return $this->hasMany(OrdreDuJourRubrique::class);
    }

}
