<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Association extends Model
{
    use HasFactory, UsesUuid;

    protected $table = 'associations';
    protected $casts = [
        'date_creation' => 'date',
        'seuil_approbation_pret' => 'decimal:2',
        'nb_signataires_pv' => 'integer',
        'delai_rappel_j7' => 'boolean',
        'delai_rappel_j3' => 'boolean',
        'delai_rappel_j1' => 'boolean',
        'config' => 'array',
        'actif' => 'boolean',
    ];

    public function membres(): HasMany { return $this->hasMany(Membre::class); }
    public function postes(): HasMany { return $this->hasMany(Poste::class); }
    public function tontines(): HasMany { return $this->hasMany(Tontine::class); }
    public function caisses(): HasMany { return $this->hasMany(Caisse::class); }
    public function reunions(): HasMany { return $this->hasMany(Reunion::class); }
    public function transactions(): HasManyThrough { return $this->hasManyThrough(Transaction::class, Caisse::class); }
    public function typesSanctions(): HasMany { return $this->hasMany(TypeSanction::class); }
    public function typesAidesSociales(): HasMany { return $this->hasMany(TypeAideSociale::class); }
}
