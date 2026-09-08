<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * "Initialisation" (RG-INIT, demande client) : distinct de l'import
 * historique. L'import reconstitue le détail opération par opération ;
 * l'initialisation pose directement un RÉSUMÉ — un point de départ — sans
 * recréer les événements qui y ont mené (ex: "6000 FCFA de sanctions dues"
 * plutôt que les 3 cotisations manquées qui l'expliquent).
 *
 * - membres.absences_cumulees_initiales : offset ajouté au comptage réel
 *   des absences pour que les paliers de sanction (paliers_absence,
 *   patch précédent) démarrent au bon seuil dès le premier jour.
 * - tontine_parts.montant_accumule_initial : offset ajouté au solde
 *   accumulé calculé à la volée pour la cagnotte (RemiseGainService).
 * - aide_sociale_initiale : nombre d'aides déjà reçues par membre et par
 *   type, AVANT l'usage de l'app — pour que le plafond à vie (nb_max_vie)
 *   tienne compte de l'historique dès le départ. Affecte volontairement
 *   uniquement le plafond à VIE, pas le plafond annuel (qui se
 *   réinitialise chaque année civile et n'a donc pas de sens à
 *   "pré-remplir" avec un total historique non daté).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;

        DB::statement('ALTER TABLE membres ADD COLUMN IF NOT EXISTS absences_cumulees_initiales SMALLINT NOT NULL DEFAULT 0');
        DB::statement('ALTER TABLE tontine_parts ADD COLUMN IF NOT EXISTS montant_accumule_initial NUMERIC(15,2) NOT NULL DEFAULT 0');

        DB::statement(<<<'SQL'
            CREATE TABLE IF NOT EXISTS aide_sociale_initiale (
                id                UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
                membre_id         UUID    NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
                type_aide_id      UUID    NOT NULL REFERENCES types_aide_sociale(id) ON DELETE CASCADE,
                nombre_deja_recu  SMALLINT NOT NULL DEFAULT 0 CHECK (nombre_deja_recu >= 0),
                updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT aide_sociale_initiale_uq UNIQUE (membre_id, type_aide_id)
            )
        SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;

        DB::statement('DROP TABLE IF EXISTS aide_sociale_initiale');
        DB::statement('ALTER TABLE tontine_parts DROP COLUMN IF EXISTS montant_accumule_initial');
        DB::statement('ALTER TABLE membres DROP COLUMN IF EXISTS absences_cumulees_initiales');
    }
};
