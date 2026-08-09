<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    const UPDATED_AT = null;

    use UsesUuid;

    protected $table = 'notifications';

    protected $fillable = [
        'association_id',
        'reunion_id',
        'membre_id',
        'canal',
        'type_evenement',
        'sujet',
        'contenu',
        'statut',
        'programmee_a',
        'envoyee_a',
        'nb_tentatives',
        'erreur',
    ];

    protected $casts = [
            'programmee_a' => 'datetime',
            'envoyee_a' => 'datetime',
            'nb_tentatives' => 'integer'
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }


    public function reunion()
    {
        return $this->belongsTo(Reunion::class);
    }


    public function membre()
    {
        return $this->belongsTo(Membre::class);
    }

}
