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
        // La matrice RBAC (permissions_roles) est une donnée de CONFIGURATION,
        // pas une donnée de test : elle doit être seedée dans tous les environnements.
        $this->call(PermissionsRolesSeeder::class);

        // Tout ce qui suit (association + compte super_admin de convenance)
        // est un raccourci pour le développement local. On refuse de créer
        // le moindre compte par défaut en dehors de local/testing, pour ne
        // jamais exposer un identifiant connu (admin@test.local / "password")
        // en production.
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->info('Environnement '.app()->environment().' détecté : aucun compte de démonstration créé (voir DemoDataSeeder pour un jeu de données complet en local).');

            return;
        }

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
            // Mot de passe aléatoire à chaque exécution (jamais le même codé en dur),
            // affiché une seule fois dans la console pour l'environnement local.
            $motDePasse = Str::password(16);

            DB::table('tontine.utilisateurs')->insert([
                'membre_id' => $membreId,
                'email' => 'admin@test.local',
                'password_hash' => Hash::make($motDePasse),
                'role' => 'super_admin',
                'actif' => true,
            ]);

            $this->command?->warn("Compte local admin@test.local créé — mot de passe (à noter, non stocké) : {$motDePasse}");
        }
    }
}
