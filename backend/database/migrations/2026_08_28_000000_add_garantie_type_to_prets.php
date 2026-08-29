<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Le champ "Garantie" du formulaire de prêt (Caution d'un membre / Blocage
 * épargne / Retenue sur tontine / Aucune) n'existait nulle part en base et
 * n'était même jamais envoyé à l'API — un simple texte décoratif, sans le
 * moindre effet réel. On lui donne enfin une vraie colonne et un vrai
 * comportement métier (voir PretService::demander) :
 * - caution_membre  : avaliste_id devient obligatoire et vérifié
 * - retenue_tontine : le membre doit détenir au moins une part de tontine
 *   active au moment de la demande (sinon rien à retenir, garantie vide de sens)
 * - blocage_epargne : pas encore de module épargne par membre dans l'appli —
 *   accepté pour l'instant sans vérification supplémentaire, à renforcer
 *   quand ce module existera
 * - aucune          : aucune contrainte
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            DO \$\$ BEGIN
                CREATE TYPE type_garantie_pret AS ENUM ('caution_membre', 'blocage_epargne', 'retenue_tontine', 'aucune');
            EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
        ");
        DB::statement("ALTER TABLE prets ADD COLUMN IF NOT EXISTS garantie_type type_garantie_pret NOT NULL DEFAULT 'aucune'");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE prets DROP COLUMN IF EXISTS garantie_type');
        DB::statement('DROP TYPE IF EXISTS type_garantie_pret');
    }
};
