<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class SeanceTransaction extends Model
{
    use UsesUuid;

    const UPDATED_AT = null;

    protected $table = 'seance_transactions';

    protected $fillable = [
        'reunion_id', 'type', 'membre_id', 'montant', 'libelle',
        'reference_sanction_id', 'reference_pret_id', 'caisse_id', 'note', 'created_by',
        'annulee', 'annulee_at', 'annulee_par', 'motif_annulation',
    ];

    protected $casts = [
        'montant' => 'decimal:2',
        'annulee' => 'boolean',
        'annulee_at' => 'datetime',
    ];

    public function reunion()
    {
        return $this->belongsTo(Reunion::class);
    }

    public function membre()
    {
        return $this->belongsTo(Membre::class);
    }

    public function sanction()
    {
        return $this->belongsTo(SanctionMembre::class, 'reference_sanction_id');
    }

    public function pret()
    {
        return $this->belongsTo(Pret::class, 'reference_pret_id');
    }

    public function caisse()
    {
        return $this->belongsTo(Caisse::class);
    }
}
