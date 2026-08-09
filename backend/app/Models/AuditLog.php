<?php

namespace App\Models;


use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    const UPDATED_AT = null;

    protected $table = 'audit_log';

    protected $fillable = [
        'association_id',
        'utilisateur_id',
        'action',
        'table_name',
        'record_id',
        'valeur_avant',
        'valeur_apres',
        'ip_address',
    ];

    protected $casts = [
            'valeur_avant' => 'array',
            'valeur_apres' => 'array'
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }


    public function utilisateur()
    {
        return $this->belongsTo(Utilisateur::class);
    }

}
