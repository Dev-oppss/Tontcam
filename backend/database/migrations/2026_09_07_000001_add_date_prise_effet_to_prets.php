<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Jusqu'ici, la date de départ d'un prêt (date_debut, et donc les dates de
 * chaque échéance de l'amortissement) était systématiquement calée sur
 * l'instant présent : now() au moment de la DEMANDE pour générer l'échéancier,
 * puis re-écrasée par now() une seconde fois au DÉCAISSEMENT — deux valeurs
 * different et aucune des deux réellement choisie par le trésorier.
 *
 * Le trésorier doit pouvoir définir explicitement la "date de prise d'effet"
 * du prêt (ex : la date réelle de remise de l'argent au membre, qui peut
 * différer de la date de saisie dans l'app) — c'est cette date qui sert
 * ensuite de base à la génération de l'échéancier.
 *
 * Nullable : si non renseignée, le comportement reste celui d'avant
 * (aujourd'hui, au moment de la demande).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE prets ADD COLUMN IF NOT EXISTS date_prise_effet DATE NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE prets DROP COLUMN IF EXISTS date_prise_effet');
    }
};
