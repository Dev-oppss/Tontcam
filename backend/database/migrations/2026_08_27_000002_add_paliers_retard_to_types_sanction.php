<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sanction automatique de retard à l'arrivée en réunion (nouveau déclencheur
 * 'retard_presence', même famille que absence_non_excusee/retard_cotisation/
 * retard_pret déjà en place — cf. app/Services/SanctionService.php).
 *
 * Contrairement aux 3 déclencheurs existants, le montant n'est pas un simple
 * fixe/pourcentage/journalier : il dépend de PALIERS de retard (ex. 100 FCFA
 * à partir de 15 min, 250 FCFA à partir de 3h). On stocke donc ces paliers en
 * JSONB plutôt que d'ajouter un 4e mode_calcul (ALTER TYPE ... ADD VALUE sur
 * un enum Postgres ne peut pas s'exécuter dans la même transaction qu'un
 * usage de cette valeur, et n'aurait de toute façon pas suffi à représenter
 * une grille de paliers).
 *
 * Format attendu : [{"minutes": 15, "montant": 100}, {"minutes": 180, "montant": 250}, ...]
 * triés par 'minutes' croissant. Le montant appliqué est celui du plus grand
 * palier dont 'minutes' <= retard constaté (voir SanctionService::retardPresence).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE types_sanction ADD COLUMN IF NOT EXISTS paliers_retard JSONB');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE types_sanction DROP COLUMN IF EXISTS paliers_retard');
    }
};
