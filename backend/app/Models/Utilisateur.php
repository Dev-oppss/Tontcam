<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Utilisateur extends Authenticatable
{
    use HasApiTokens, HasFactory, UsesUuid;

    protected $table = 'utilisateurs';
    protected $hidden = ['password_hash'];
    protected $casts = ['preferences' => 'array', 'actif' => 'boolean', 'derniere_connexion' => 'datetime', 'verrouille_jusqua' => 'datetime'];

    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    public function membre()
    {
        return $this->belongsTo(Membre::class);
    }
}
