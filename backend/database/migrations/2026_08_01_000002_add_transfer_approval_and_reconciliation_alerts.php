<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE transferts_caisse ALTER COLUMN transaction_source_id DROP NOT NULL');
        DB::statement('ALTER TABLE transferts_caisse ALTER COLUMN transaction_dest_id DROP NOT NULL');
        DB::statement("ALTER TABLE transferts_caisse ADD COLUMN statut VARCHAR(20) NOT NULL DEFAULT 'execute' CHECK (statut IN ('en_attente','execute','refuse'))");
        DB::statement('ALTER TABLE transferts_caisse ADD COLUMN demande_par UUID NULL REFERENCES utilisateurs(id)');
        DB::statement('ALTER TABLE transferts_caisse ADD COLUMN demande_at TIMESTAMPTZ NULL');
        DB::statement('ALTER TABLE transferts_caisse ADD COLUMN approuve_at TIMESTAMPTZ NULL');
        DB::statement('ALTER TABLE transferts_caisse ADD COLUMN refuse_par UUID NULL REFERENCES utilisateurs(id)');
        DB::statement('ALTER TABLE transferts_caisse ADD COLUMN refuse_at TIMESTAMPTZ NULL');
        DB::statement('ALTER TABLE transferts_caisse ADD COLUMN motif_refus TEXT NULL');
        DB::statement('ALTER TABLE rapprochements_bancaires ADD COLUMN alerte_envoyee_at TIMESTAMPTZ NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE rapprochements_bancaires DROP COLUMN IF EXISTS alerte_envoyee_at');
        DB::statement('ALTER TABLE transferts_caisse DROP COLUMN IF EXISTS motif_refus, DROP COLUMN IF EXISTS refuse_at, DROP COLUMN IF EXISTS refuse_par, DROP COLUMN IF EXISTS approuve_at, DROP COLUMN IF EXISTS demande_at, DROP COLUMN IF EXISTS demande_par, DROP COLUMN IF EXISTS statut');
    }
};
