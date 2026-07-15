<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class DecisionAg extends Model
{
    use UsesUuid;

    protected $table = 'decisions_ag';

    protected $fillable = [
        'association_id',
        'reunion_id',
        'numero_decision',
        'type',
        'objet',
        'description',
        'quorum_present',
        'votes_pour',
        'votes_contre',
        'votes_abstention',
        'statut',
        'date_effet',
        'notes',
    ];

    protected $casts = [
            'quorum_present' => 'integer',
            'votes_pour' => 'integer',
            'votes_contre' => 'integer',
            'votes_abstention' => 'integer',
            'date_effet' => 'date'
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }


    public function reunion()
    {
        return $this->belongsTo(Reunion::class);
    }

}
