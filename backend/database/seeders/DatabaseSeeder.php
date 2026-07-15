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
        $association = DB::table('tontine.associations')
            ->where('nom', 'TontineApp Demo')->where('pays', 'Cameroun')->first();

        if ($association) {
            $associationId = $association->id;
            DB::table('tontine.associations')->where('id', $associationId)
                ->update(['profil_complete' => true]);
        } else {
            $associationId = (string) Str::uuid();
            DB::table('tontine.associations')->insert([
                'id' => $associationId,
                'nom' => 'TontineApp Demo',
                'nom_abrege' => 'TONTIX',
                'ville' => 'Douala',
                'pays' => 'Cameroun',
                'date_creation' => now()->toDateString(),
                'email' => 'contact@tontix.local',
                'profil_complete' => true,
            ]);
        }

        $membre = DB::table('tontine.membres')->where('email', 'admin@test.local')->first();
        if ($membre) {
            $membreId = $membre->id;
        } else {
            $membreId = (string) Str::uuid();
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
        }

        $utilisateurExiste = DB::table('tontine.utilisateurs')->where('email', 'admin@test.local')->exists();
        if (! $utilisateurExiste) {
            DB::table('tontine.utilisateurs')->insert([
                'membre_id' => $membreId,
                'email' => 'admin@test.local',
                'password_hash' => Hash::make('password'),
                'role' => 'super_admin',
                'actif' => true,
            ]);
        }

        $this->call(PermissionsRolesSeeder::class);
    }
}
