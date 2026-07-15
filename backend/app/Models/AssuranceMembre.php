<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class AssuranceMembre extends Model
{
    use UsesUuid;

    protected $table = 'assurances_membres';

    protected $fillable = [
        'membre_id',
        'type_assurance',
        'assureur',
        'numero_police',
        'date_debut',
        'date_fin',
        'prime_mensuelle',
        'actif',
        'caisse_id',
        'notes',
    ];

    protected $casts = [
            'date_debut' => 'date',
            'date_fin' => 'date',
            'prime_mensuelle' => 'decimal:2',
            'actif' => 'boolean'
    ];

    public function membre()
    {
        return $this->belongsTo(Membre::class);
    }


    public function caisse()
    {
        return $this->belongsTo(Caisse::class);
    }

}
