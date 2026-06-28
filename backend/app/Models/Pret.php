<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Pret extends Model
{
    use UsesUuid;

    protected $table = 'prets';
    protected $casts = [
        'montant_principal' => 'decimal:2',
        'taux_interet_mensuel' => 'decimal:4',
        'taux_penalite_mensuel' => 'decimal:4',
        'montant_echeance' => 'decimal:2',
        'interet_total' => 'decimal:2',
        'montant_total_du' => 'decimal:2',
        'montant_rembourse' => 'decimal:2',
        'capital_restant' => 'decimal:2',
        'date_demande' => 'date',
        'date_approbation' => 'date',
        'date_debut' => 'date',
        'date_fin_prevue' => 'date',
        'date_solde' => 'date',
    ];

    public function caisse(): BelongsTo { return $this->belongsTo(Caisse::class); }
    public function emprunteur(): BelongsTo { return $this->belongsTo(Membre::class, 'emprunteur_id'); }
    public function approuvePar(): BelongsTo { return $this->belongsTo(Utilisateur::class, 'approuve_par'); }
    public function refusePar(): BelongsTo { return $this->belongsTo(Utilisateur::class, 'refuse_par'); }
    public function avaliste(): BelongsTo { return $this->belongsTo(Membre::class, 'avaliste_id'); }
    public function transactionDecaissement(): BelongsTo { return $this->belongsTo(Transaction::class, 'transaction_decaissement_id'); }
    public function echeances(): HasMany { return $this->hasMany(EcheancePret::class); }
    public function historiques(): HasMany { return $this->hasMany(HistoriquePret::class); }
}
