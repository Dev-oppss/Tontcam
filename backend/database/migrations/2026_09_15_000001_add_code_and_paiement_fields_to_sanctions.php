<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Corrige deux régressions constatées sur l'écran Sanctions :
 *
 * 1. `types_sanction` n'avait pas de colonne `code` : le frontend envoie un
 *    slug (ex. "retard_de_cotisation") à la création d'un type personnalisé,
 *    mais il n'y avait rien pour le stocker. Résultat : TypeSanctionController
 *    l'ignorait silencieusement et sanctionFromApi/typeSanctionFromApi
 *    retombaient sur l'UUID du type comme "code", affiché brut dans la
 *    colonne Type du tableau des sanctions.
 *
 * 2. `sanctions_membres` ne stockait ni `mode_paiement` ni `details_paiement`.
 *    SanctionController::payer() transmettait ces infos uniquement à la
 *    transaction de caisse, jamais à la sanction elle-même — la colonne
 *    Paiement du tableau affichait donc toujours "—", même pour les
 *    sanctions payées.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;

        DB::statement('ALTER TABLE types_sanction ADD COLUMN IF NOT EXISTS code VARCHAR(150)');
        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS types_sanction_code_asso_uq ON types_sanction (association_id, code) WHERE code IS NOT NULL');

        DB::statement('ALTER TABLE sanctions_membres ADD COLUMN IF NOT EXISTS mode_paiement VARCHAR(50)');
        DB::statement('ALTER TABLE sanctions_membres ADD COLUMN IF NOT EXISTS details_paiement TEXT');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;

        DB::statement('DROP INDEX IF EXISTS types_sanction_code_asso_uq');
        DB::statement('ALTER TABLE types_sanction DROP COLUMN IF EXISTS code');

        DB::statement('ALTER TABLE sanctions_membres DROP COLUMN IF EXISTS mode_paiement');
        DB::statement('ALTER TABLE sanctions_membres DROP COLUMN IF EXISTS details_paiement');
    }
};
