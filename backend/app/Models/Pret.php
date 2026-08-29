<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class Pret extends Model
{
    use UsesUuid;

    protected $table = 'prets';

    protected $fillable = [
        'caisse_id',
        'reunion_id',
        'emprunteur_id',
        'montant_principal',
        'taux_interet_mensuel',
        'taux_penalite_mensuel',
        'garantie_type',
        'methode_amortissement',
        'nb_echeances',
        'montant_echeance',
        'interet_total',
        'montant_total_du',
        'montant_rembourse',
        'capital_restant',
        'statut',
        'date_demande',
        'date_approbation',
        'date_debut',
        'date_fin_prevue',
        'date_solde',
        'approuve_par',
        'refuse_par',
        'motif_refus',
        'avaliste_id',
        'transaction_decaissement_id',
        'notes',
        'created_by',
    ];

    protected $casts = [
            'montant_principal' => 'decimal:2',
            'taux_interet_mensuel' => 'decimal:4',
            'taux_penalite_mensuel' => 'decimal:4',
            'nb_echeances' => 'integer',
            'montant_echeance' => 'decimal:2',
            'interet_total' => 'decimal:2',
            'montant_total_du' => 'decimal:2',
            'montant_rembourse' => 'decimal:2',
            'capital_restant' => 'decimal:2',
            'date_demande' => 'date',
            'date_approbation' => 'date',
            'date_debut' => 'date',
            'date_fin_prevue' => 'date',
            'date_solde' => 'date'
    ];

    public function reunion()
    {
        return $this->belongsTo(Reunion::class);
    }

    public function caisse()
    {
        return $this->belongsTo(Caisse::class);
    }


    public function emprunteur()
    {
        return $this->belongsTo(Membre::class, 'emprunteur_id');
    }


    public function avaliste()
    {
        return $this->belongsTo(Membre::class, 'avaliste_id');
    }


    public function approbateur()
    {
        return $this->belongsTo(Utilisateur::class, 'approuve_par');
    }


    public function refuseur()
    {
        return $this->belongsTo(Utilisateur::class, 'refuse_par');
    }


    public function decaissement()
    {
        return $this->belongsTo(Transaction::class, 'transaction_decaissement_id');
    }


    public function echeances()
    {
        return $this->hasMany(EcheancePret::class, 'pret_id');
    }


    public function historique()
    {
        return $this->hasMany(HistoriquePret::class, 'pret_id');
    }

}
