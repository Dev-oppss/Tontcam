<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Plafond à VIE par type d'aide sociale (RG-SOC, demande client) : distinct
 * de nb_max_par_an (qui se réinitialise chaque année civile). Ex : "Mariage"
 * plafonné à 4 sur toute la durée d'adhésion du membre — au-delà, plus
 * jamais d'aide de ce type pour lui, quelle que soit l'année. NULL = pas de
 * plafond à vie (seul l'éventuel plafond annuel s'applique).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;

        DB::statement('ALTER TABLE types_aide_sociale ADD COLUMN IF NOT EXISTS nb_max_vie SMALLINT CHECK (nb_max_vie > 0)');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;

        DB::statement('ALTER TABLE types_aide_sociale DROP COLUMN IF EXISTS nb_max_vie');
    }
};
