<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Le formulaire "Modifier le point" (ordre du jour d'une réunion) propose un
 * sélecteur "Type" (administratif/financier/attribution/disciplinaire/divers)
 * et un sélecteur "Acteur responsable" (président/trésorier/secrétaire/...),
 * mais aucune des deux colonnes n'existait sur ordre_du_jour_items : la
 * sélection de l'utilisateur était silencieusement perdue à l'enregistrement.
 *
 * `acteur_role` est volontairement un rôle (string), distinct de la colonne
 * existante `rapporteur_id` (qui référence un membre précis) : la cahier des
 * charges permet de restreindre la saisie d'une rubrique à "quiconque occupe
 * ce rôle", pas uniquement à une personne nommément désignée.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE ordre_du_jour_items ADD COLUMN IF NOT EXISTS type VARCHAR(50)');
        DB::statement('ALTER TABLE ordre_du_jour_items ADD COLUMN IF NOT EXISTS acteur_role VARCHAR(50)');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE ordre_du_jour_items DROP COLUMN IF EXISTS type');
        DB::statement('ALTER TABLE ordre_du_jour_items DROP COLUMN IF EXISTS acteur_role');
    }
};
