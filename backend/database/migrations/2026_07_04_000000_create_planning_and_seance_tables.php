<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            CREATE TABLE planning_tours (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                tontine_id UUID NOT NULL REFERENCES tontines(id) ON DELETE CASCADE,
                numero_tour INTEGER NOT NULL,
                beneficiaire_membre_id UUID REFERENCES membres(id) ON DELETE SET NULL,
                montant_prevu NUMERIC(14,2) NOT NULL DEFAULT 0,
                date_prevue DATE,
                statut VARCHAR(20) NOT NULL DEFAULT 'planifie',
                notes TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        ");

        DB::statement("
            CREATE TABLE seance_transactions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                reunion_id UUID NOT NULL REFERENCES reunions(id) ON DELETE CASCADE,
                type VARCHAR(30) NOT NULL,
                membre_id UUID REFERENCES membres(id) ON DELETE SET NULL,
                montant NUMERIC(14,2) NOT NULL,
                libelle VARCHAR(300),
                reference_sanction_id UUID REFERENCES sanctions_membres(id) ON DELETE SET NULL,
                reference_pret_id UUID REFERENCES prets(id) ON DELETE SET NULL,
                caisse_id UUID REFERENCES caisses(id) ON DELETE SET NULL,
                note TEXT,
                created_by UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        ");

        DB::statement('CREATE INDEX idx_planning_tours_tontine ON planning_tours(tontine_id)');
        DB::statement('CREATE INDEX idx_seance_tx_reunion ON seance_transactions(reunion_id)');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS seance_transactions CASCADE');
        DB::statement('DROP TABLE IF EXISTS planning_tours CASCADE');
    }
};
