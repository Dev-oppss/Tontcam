<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class MembrePoste extends Model
{
    const UPDATED_AT = null;

    use UsesUuid;

    protected $table = 'membre_postes';

    protected $fillable = [
        'membre_id',
        'poste_id',
        'date_debut',
        'date_fin',
        'notes',
    ];

    protected $casts = [
            'date_debut' => 'date',
            'date_fin' => 'date'
    ];

    public function membre()
    {
        return $this->belongsTo(Membre::class);
    }


    public function poste()
    {
        return $this->belongsTo(Poste::class);
    }

}
