<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class EvenementSocial extends Model
{
    use UsesUuid;

    protected $table = 'evenements_sociaux';

    protected $fillable = [
        'association_id',
        'membre_id',
        'type_aide_id',
        'description',
        'date_evenement',
        'date_declaration',
        'montant_demande',
        'montant_accorde',
        'statut',
        'pieces_jointes',
        'approuve_par',
        'approuve_at',
        'refuse_par',
        'motif_refus',
        'transaction_id',
        'date_versement',
        'notes',
    ];

    protected $casts = [
            'date_evenement' => 'date',
            'date_declaration' => 'date',
            'montant_demande' => 'decimal:2',
            'montant_accorde' => 'decimal:2',
            'pieces_jointes' => 'array',
            'approuve_at' => 'datetime',
            'date_versement' => 'datetime'
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }


    public function membre()
    {
        return $this->belongsTo(Membre::class);
    }


    public function typeAide()
    {
        return $this->belongsTo(TypeAideSociale::class, 'type_aide_id');
    }


    public function approbateur()
    {
        return $this->belongsTo(Utilisateur::class, 'approuve_par');
    }


    public function refuseur()
    {
        return $this->belongsTo(Utilisateur::class, 'refuse_par');
    }


    public function transaction()
    {
        return $this->belongsTo(Transaction::class);
    }

}
