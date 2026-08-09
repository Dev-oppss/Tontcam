<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Jeu de données de démonstration ("Tontine Solidarité Cameroun").
 *
 * ⚠️ Ce seeder N'EST JAMAIS appelé automatiquement (ni par les migrations,
 * ni par DatabaseSeeder). Il doit être lancé explicitement, et seulement
 * en local/démo :
 *
 *   php artisan db:seed --class="Database\Seeders\DemoDataSeeder"
 *
 * Il refuse de s'exécuter si APP_ENV=production, pour éviter qu'une
 * exécution accidentelle ne pollue une base réelle.
 */
class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->error('DemoDataSeeder refusé : APP_ENV=production. Ce seeder ne doit tourner qu\'en local/démo.');

            return;
        }

        $sqlPath = base_path('../database/seed_demo.sql');

        if (! file_exists($sqlPath)) {
            $this->command?->warn("Fichier introuvable : {$sqlPath} — rien à faire.");

            return;
        }

        DB::unprepared((string) file_get_contents($sqlPath));

        $this->command?->info('Données de démonstration insérées (association "Tontine Solidarité Cameroun").');
    }
}
