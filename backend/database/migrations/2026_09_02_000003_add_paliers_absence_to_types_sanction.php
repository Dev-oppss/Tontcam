<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Palier de sanction sur ABSENCES CUMULÉES (RG-SAN, demande client) :
 * distinct de la sanction "par absence" existante (déclencheur
 * absence_non_excusee, appliquée à chaque absence non excusée). Ici, en
 * plus, quand le nombre total d'absences non excusées d'un membre atteint un
 * seuil paramétré (ex: 5, 10, 15 — variable par association), une sanction
 * SUPPLÉMENTAIRE et ponctuelle se déclenche, une seule fois par seuil
 * franchi. Cumul depuis toujours (jamais remis à zéro) — à ajuster plus tard
 * si l'association précise un fonctionnement différent.
 *
 * Format JSONB, même style que paliers_retard :
 * [{"nombre": 5, "montant": 3000}, {"nombre": 10, "montant": 6000}]
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;

        DB::statement("ALTER TABLE types_sanction ADD COLUMN IF NOT EXISTS paliers_absence JSONB NOT NULL DEFAULT '[]'::jsonb");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;

        DB::statement('ALTER TABLE types_sanction DROP COLUMN IF EXISTS paliers_absence');
    }
};
