<?php

namespace App\Models;

use App\Models\Concerns\UsesUuid;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Utilisateur extends Authenticatable
{
    use HasApiTokens, UsesUuid;

    protected $table = 'utilisateurs';
    protected $hidden = ['password_hash', 'token_refresh', 'token_reset_mdp'];

    protected $fillable = [
        'membre_id',
        'email',
        'password_hash',
        'role',
        'actif',
        'tentatives_echec',
        'verrouille_jusqua',
        'derniere_connexion',
        'token_refresh',
        'token_reset_mdp',
        'token_reset_exp',
        'preferences',
    ];

    protected $casts = [
        'actif' => 'boolean',
        'tentatives_echec' => 'integer',
        'verrouille_jusqua' => 'datetime',
        'derniere_connexion' => 'datetime',
        'token_reset_exp' => 'datetime',
        'preferences' => 'array',
    ];

    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    public function membre()
    {
        return $this->belongsTo(Membre::class, 'membre_id');
    }
}
