<?php

namespace Database\Factories;

use App\Models\Association;
use Illuminate\Database\Eloquent\Factories\Factory;

class AssociationFactory extends Factory
{
    protected $model = Association::class;

    public function definition(): array
    {
        return [
            'nom' => fake()->company().' Tontine',
            'nom_abrege' => strtoupper(fake()->lexify('???')),
            'ville' => 'Douala',
            'pays' => 'Cameroun',
            'telephone' => fake()->phoneNumber(),
            'email' => fake()->unique()->companyEmail(),
            'date_creation' => now()->toDateString(),
            'devise' => 'XAF',
            'actif' => true,
        ];
    }
}