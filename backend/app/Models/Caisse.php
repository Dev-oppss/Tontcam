<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;

class Caisse extends Model
{
    use UsesUuid, SoftDeletes;

    protected $table = 'caisses';

    protected $fillable = [
        'association_id',
        'libelle',
        'description',
        'type',
        'solde_initial',
        'solde_actuel',
        'compte_bancaire_id',
        'tontine_id',
        'pret_autorise',
        'taux_interet_mensuel',
        'taux_penalite_mensuel',
        'duree_max_pret_mois',
        'methode_amortissement',
        'seuil_alerte_bas',
        'actif',
        'date_ouverture',
        'date_cloture',
        'config',
        'suivi_epargne',
    ];

    protected $casts = [
            'solde_initial' => 'decimal:2',
            'solde_actuel' => 'decimal:2',
            'pret_autorise' => 'boolean',
            'taux_interet_mensuel' => 'decimal:4',
            'taux_penalite_mensuel' => 'decimal:4',
            'duree_max_pret_mois' => 'integer',
            'seuil_alerte_bas' => 'decimal:2',
            'actif' => 'boolean',
            'date_ouverture' => 'date',
            'date_cloture' => 'date',
            'config' => 'array',
            'suivi_epargne' => 'boolean'
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }


    public function compteBancaire()
    {
        return $this->belongsTo(CompteBancaire::class);
    }


    public function tontine()
    {
        return $this->belongsTo(Tontine::class);
    }


    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }

    /**
     * Une caisse reste modifiable tant qu'aucune transaction "réelle" n'y a
     * été enregistrée. L'écriture de solde initial (reference_type =
     * 'solde_initial') créée automatiquement à l'ouverture ne compte pas :
     * sinon aucune caisse ouverte avec un solde de départ ne serait jamais
     * modifiable. Les transactions annulées ne comptent pas non plus (pt.12
     * du rapport de test) : une opération supprimée/annulée n'a plus d'effet
     * réel sur la caisse, elle ne doit donc plus bloquer sa modification.
     */
    public function getHasTransactionsAttribute(): bool
    {
        return $this->transactions()
            ->where('reference_type', '!=', 'solde_initial')
            ->where('annulee', false)
            ->exists();
    }

    protected $appends = ['has_transactions'];


    public function prets()
    {
        return $this->hasMany(Pret::class);
    }


    public function rapprochements()
    {
        return $this->hasMany(RapprochementBancaire::class);
    }

}
