<?php

namespace Database\Factories;

use App\Models\Membre;
use App\Models\Utilisateur;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

class UtilisateurFactory extends Factory
{
    protected $model = Utilisateur::class;

    public function definition(): array
    {
        return [
            'membre_id' => Membre::factory(),
            'email' => fake()->unique()->safeEmail(),
            'password_hash' => Hash::make('password'),
            'role' => 'membre',
            'actif' => true,
            'preferences' => [],
        ];
    }
}
