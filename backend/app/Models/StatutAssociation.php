<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class StatutAssociation extends Model
{
    use HasFactory, HasUuids;

    public $timestamps = false;

    protected $table = 'statuts_association';

    protected $fillable = [
        'association_id',
        'version',
        'fichier_url',
        'date_adoption',
        'signataires',
        'uploaded_by',
        'est_actif',
    ];

    protected $casts = [
        'date_adoption' => 'date',
        'signataires' => 'array',
        'est_actif' => 'boolean',
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }

    public function uploadePar()
    {
        return $this->belongsTo(Utilisateur::class, 'uploaded_by');
    }
}
