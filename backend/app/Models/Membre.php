<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Membre extends Model
{
    use HasFactory, UsesUuid;

    protected $table = 'membres';
    protected $casts = ['date_naissance' => 'date', 'date_adhesion' => 'date', 'est_assure' => 'boolean'];

    public function association(): BelongsTo { return $this->belongsTo(Association::class); }
    public function utilisateur(): HasOne { return $this->hasOne(Utilisateur::class); }
    public function parts(): HasMany { return $this->hasMany(TontinePart::class); }
    public function prets(): HasMany { return $this->hasMany(Pret::class, 'emprunteur_id'); }
    public function sanctions(): HasMany { return $this->hasMany(SanctionMembre::class); }
    public function presences(): HasMany { return $this->hasMany(Presence::class); }
}
