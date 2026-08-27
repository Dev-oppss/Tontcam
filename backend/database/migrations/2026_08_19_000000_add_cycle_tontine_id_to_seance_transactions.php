<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * BUGFIX : les cotisations saisies via la « Feuille de cotisation » créent une
 * SeanceTransaction (type='cotisation') qui alimente réellement la caisse
 * (CaisseService::entree), en parallèle des lignes CotisationTontine du
 * CycleTontine — sans aucun lien entre les deux. Résultat : annuler le cycle
 * (TontineCycleService::annulerCycleAvantVersement) ne pouvait ni retrouver
 * ni contre-passer ces transactions, qui restaient visibles (argent + ligne)
 * en caisse, dans l'historique et dans le rapport PV malgré l'annulation.
 *
 * Cette colonne permet de retrouver, à l'annulation d'un cycle, toutes les
 * SeanceTransaction qui lui sont liées afin de les contre-passer proprement.
 */
return new class extends Migration {
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;
        DB::statement('ALTER TABLE seance_transactions ADD COLUMN IF NOT EXISTS cycle_tontine_id UUID NULL REFERENCES cycles_tontine(id) ON DELETE SET NULL');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_seance_tx_cycle ON seance_transactions(cycle_tontine_id)');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;
        DB::statement('DROP INDEX IF EXISTS idx_seance_tx_cycle');
        DB::statement('ALTER TABLE seance_transactions DROP COLUMN IF EXISTS cycle_tontine_id');
    }
};
