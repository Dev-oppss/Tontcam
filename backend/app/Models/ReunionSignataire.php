<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class ReunionSignataire extends Model
{
    const UPDATED_AT = null;

    use UsesUuid;

    protected $table = 'reunion_signataires';

    protected $fillable = [
        'reunion_id',
        'membre_id',
        'ordre_signature',
        'role_signature',
        'signed_at',
        'commentaire',
    ];

    protected $casts = [
            'signed_at' => 'datetime',
            'ordre_signature' => 'integer'
    ];

    public function reunion()
    {
        return $this->belongsTo(Reunion::class);
    }


    public function membre()
    {
        return $this->belongsTo(Membre::class);
    }

}
