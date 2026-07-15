<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class PlanningTour extends Model
{
    use UsesUuid;

    const UPDATED_AT = null;

    protected $table = 'planning_tours';

    protected $fillable = [
        'tontine_id', 'numero_tour', 'beneficiaire_membre_id',
        'montant_prevu', 'date_prevue', 'statut', 'notes',
    ];

    protected $casts = [
        'numero_tour' => 'integer',
        'montant_prevu' => 'decimal:2',
        'date_prevue' => 'date',
    ];

    public function tontine()
    {
        return $this->belongsTo(Tontine::class);
    }

    public function beneficiaire()
    {
        return $this->belongsTo(Membre::class, 'beneficiaire_membre_id');
    }
}
