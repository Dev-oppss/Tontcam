<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Model;

class CompteBancaire extends Model
{
    use UsesUuid;

    protected $table = 'comptes_bancaires';

    protected $fillable = [
        'association_id',
        'banque',
        'agence',
        'numero_compte',
        'iban',
        'titulaire',
        'solde_dernier_releve',
        'date_dernier_releve',
        'actif',
        'notes',
    ];

    protected $casts = [
            'solde_dernier_releve' => 'decimal:2',
            'date_dernier_releve' => 'date',
            'actif' => 'boolean'
    ];

    public function association()
    {
        return $this->belongsTo(Association::class);
    }


    public function caisses()
    {
        return $this->hasMany(Caisse::class);
    }


    public function rapprochements()
    {
        return $this->hasMany(RapprochementBancaire::class);
    }

}
