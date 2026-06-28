<?php

namespace Database\Factories;

use App\Models\Association;
use App\Models\Membre;
use Illuminate\Database\Eloquent\Factories\Factory;

class MembreFactory extends Factory
{
    protected $model = Membre::class;

    public function definition(): array
    {
        return [
            'association_id' => Association::factory(),
            'matricule' => fake()->unique()->numerify('M-###'),
            'nom' => fake()->lastName(),
            'prenom' => fake()->firstName(),
            'sexe' => fake()->randomElement(['M','F']),
            'telephone' => fake()->unique()->numerify('+2376########'),
            'email' => fake()->unique()->safeEmail(),
            'date_adhesion' => now()->toDateString(),
            'statut' => 'actif',
        ];
    }
}