<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Mode "cagnotte" d'une tontine (RG-TON, demande client) : les cotisations
 * n'attribuent plus systématiquement un gagnant par cycle — l'argent
 * s'accumule par part, et une "remise de gains" ultérieure, indépendante
 * des cycles, distribue à 0, 1 ou N bénéficiaires le montant qu'ils
 * souhaitent (calculé par défaut sur l'accumulé de chaque part, corrigible).
 *
 * Le montant accumulé n'est PAS stocké en colonne (évite toute dérive) :
 * il se calcule à la volée = Σ cotisations.montant_verse de la part
 * − Σ remise_gain_lignes.montant_verse déjà versées à cette part.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;

        // Activable à tout moment (même tontine en cours) ; irréversible une
        // fois vrai — contrainte applicative (TontineService), pas SQL, pour
        // pouvoir renvoyer un message d'erreur clair plutôt qu'une violation
        // de contrainte brute.
        DB::statement('ALTER TABLE tontines ADD COLUMN IF NOT EXISTS mode_cagnotte BOOLEAN NOT NULL DEFAULT FALSE');

        DB::statement(<<<'SQL'
            CREATE TABLE IF NOT EXISTS remises_gain (
                id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
                tontine_id   UUID          NOT NULL REFERENCES tontines(id) ON DELETE CASCADE,
                reunion_id   UUID          REFERENCES reunions(id),
                date_remise  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
                notes        TEXT,
                created_by   UUID          REFERENCES utilisateurs(id),
                created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
                updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
            )
        SQL);

        DB::statement(<<<'SQL'
            CREATE TABLE IF NOT EXISTS remise_gain_lignes (
                id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
                remise_gain_id   UUID          NOT NULL REFERENCES remises_gain(id) ON DELETE CASCADE,
                tontine_part_id  UUID          NOT NULL REFERENCES tontine_parts(id),
                montant_verse    NUMERIC(15,2) NOT NULL CHECK (montant_verse > 0),
                notes            TEXT,
                created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
                CONSTRAINT remise_gain_lignes_part_uq UNIQUE (remise_gain_id, tontine_part_id)
            )
        SQL);

        DB::statement('CREATE INDEX IF NOT EXISTS idx_remise_gain_lignes_part ON remise_gain_lignes(tontine_part_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_remises_gain_tontine ON remises_gain(tontine_id)');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;

        DB::statement('DROP TABLE IF EXISTS remise_gain_lignes');
        DB::statement('DROP TABLE IF EXISTS remises_gain');
        DB::statement('ALTER TABLE tontines DROP COLUMN IF EXISTS mode_cagnotte');
    }
};
