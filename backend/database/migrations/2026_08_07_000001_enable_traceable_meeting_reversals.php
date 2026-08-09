<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;
        DB::statement("ALTER TABLE seance_transactions ADD COLUMN IF NOT EXISTS annulee BOOLEAN NOT NULL DEFAULT FALSE");
        DB::statement('ALTER TABLE seance_transactions ADD COLUMN IF NOT EXISTS annulee_at TIMESTAMPTZ NULL');
        DB::statement('ALTER TABLE seance_transactions ADD COLUMN IF NOT EXISTS annulee_par UUID NULL REFERENCES utilisateurs(id)');
        DB::statement('ALTER TABLE seance_transactions ADD COLUMN IF NOT EXISTS motif_annulation TEXT NULL');
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION fn_proteger_transaction_validee()
            RETURNS TRIGGER LANGUAGE plpgsql AS $$
            BEGIN
                IF OLD.valide AND ((to_jsonb(NEW) - ARRAY['annulee','annulee_par','annulee_at','motif_annulation']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['annulee','annulee_par','annulee_at','motif_annulation'])) THEN
                    RAISE EXCEPTION 'Une transaction validée est immuable. Créez une écriture corrective.';
                END IF;
                IF OLD.annulee AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Une transaction annulée est immuable.'; END IF;
                RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
            END;
            $$;
        SQL);
    }
    public function down(): void {}
};
