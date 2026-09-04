<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Module ÉPARGNE (RG-EPA, demande client) : une caisse "tirelire commune" —
 * chaque membre y dépose ce qu'il veut, quand il veut. Le solde de chaque
 * membre se calcule à la volée (jamais stocké, même logique que la cagnotte
 * tontine — voir RemiseGainService) : Σ dépôts + Σ intérêts − Σ retraits.
 *
 * Différences avec la cagnotte tontine :
 * - Le retrait n'est pas sélectif (0 à N bénéficiaires choisis) mais
 *   COLLECTIF : une "cassation générale" rembourse chaque membre de la
 *   totalité de son solde, en une fois, à tout le monde.
 * - Si l'argent de la caisse sert à financer un prêt, l'intérêt perçu au
 *   remboursement est partagé au prorata du solde de CHAQUE membre au
 *   moment précis du décaissement du prêt (photo figée — "snapshot" — pas
 *   le solde courant, qui peut avoir bougé depuis) — d'où la table
 *   pret_epargne_snapshots.
 * - Cette épargne peut servir de garantie de prêt (garantie_type =
 *   blocage_epargne côté prêt) : en cas de défaut, le trésorier coupe
 *   manuellement sur le solde épargne du membre (mouvement
 *   'retrait_garantie') — décision humaine, jamais automatique.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;

        // Activable à tout moment sur une caisse existante ; irréversible une fois
        // vrai — même logique que tontines.mode_cagnotte (cohérence des mouvements
        // déjà enregistrés si on désactivait après coup).
        DB::statement('ALTER TABLE caisses ADD COLUMN IF NOT EXISTS suivi_epargne BOOLEAN NOT NULL DEFAULT FALSE');

        DB::statement("CREATE TYPE type_mouvement_epargne AS ENUM ('depot','interet','retrait','retrait_garantie')");

        DB::statement(<<<'SQL'
            CREATE TABLE IF NOT EXISTS epargne_mouvements (
                id             UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
                caisse_id      UUID    NOT NULL REFERENCES caisses(id) ON DELETE CASCADE,
                membre_id      UUID    NOT NULL REFERENCES membres(id),
                type           type_mouvement_epargne NOT NULL,
                montant        NUMERIC(15,2) NOT NULL CHECK (montant > 0),
                pret_id        UUID    REFERENCES prets(id),
                transaction_id UUID    REFERENCES transactions(id),
                motif          TEXT,
                created_by     UUID    REFERENCES utilisateurs(id),
                created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        SQL);

        DB::statement(<<<'SQL'
            CREATE TABLE IF NOT EXISTS pret_epargne_snapshots (
                id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
                pret_id         UUID    NOT NULL REFERENCES prets(id) ON DELETE CASCADE,
                membre_id       UUID    NOT NULL REFERENCES membres(id),
                solde_snapshot  NUMERIC(15,2) NOT NULL CHECK (solde_snapshot >= 0),
                CONSTRAINT pret_epargne_snapshots_uq UNIQUE (pret_id, membre_id)
            )
        SQL);

        DB::statement('CREATE INDEX IF NOT EXISTS idx_epargne_mouvements_caisse_membre ON epargne_mouvements(caisse_id, membre_id)');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;

        DB::statement('DROP TABLE IF EXISTS pret_epargne_snapshots');
        DB::statement('DROP TABLE IF EXISTS epargne_mouvements');
        DB::statement('DROP TYPE IF EXISTS type_mouvement_epargne');
        DB::statement('ALTER TABLE caisses DROP COLUMN IF EXISTS suivi_epargne');
    }
};
