<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class ParametreAssociation extends Model
{
    use UsesUuid;

    protected $table = 'parametres_association';

    protected $fillable = [
        'association_id',
        'cle',
        'valeur',
        'valeur_json',
        'description',
        'modifiable',
        'updated_by',
    ];

    protected $casts = [
            'valeur_json' => 'array',
            'modifiable' => 'boolean'
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }


    public function modificateur()
    {
        return $this->belongsTo(Utilisateur::class, 'updated_by');
    }

}
