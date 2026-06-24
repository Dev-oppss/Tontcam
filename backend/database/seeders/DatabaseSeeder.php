<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $associationId = (string) Str::uuid();
        $membreId = (string) Str::uuid();

        DB::table('tontine.associations')->insert([
            'id' => $associationId,
            'nom' => 'TontineApp Demo',
            'nom_abrege' => 'TONTIX',
            'ville' => 'Douala',
            'pays' => 'Cameroun',
            'date_creation' => now()->toDateString(),
            'email' => 'contact@tontix.local',
        ]);

        DB::table('tontine.membres')->insert([
            'id' => $membreId,
            'association_id' => $associationId,
            'matricule' => 'M-001',
            'nom' => 'TAGNE',
            'prenom' => 'Roger',
            'telephone' => '+237600000000',
            'email' => 'admin@test.local',
            'date_adhesion' => now()->toDateString(),
            'statut' => 'actif',
        ]);

        DB::table('tontine.utilisateurs')->insert([
            'membre_id' => $membreId,
            'email' => 'admin@test.local',
            'password_hash' => Hash::make('password'),
            'role' => 'admin',
            'actif' => true,
        ]);
    }
}
