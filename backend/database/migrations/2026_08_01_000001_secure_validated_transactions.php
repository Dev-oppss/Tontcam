<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // La contrainte s'applique aux nouvelles écritures sans invalider un
        // historique existant dont le mode ou le valideur n'était pas saisi.
        DB::statement("ALTER TABLE transactions ADD CONSTRAINT transactions_validees_completes_ck CHECK (NOT valide OR (mode_paiement IS NOT NULL AND valide_par IS NOT NULL)) NOT VALID");

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION fn_proteger_transaction_validee()
            RETURNS TRIGGER LANGUAGE plpgsql AS $$
            BEGIN
                IF OLD.valide THEN
                    RAISE EXCEPTION 'Une transaction validée est immuable. Créez une écriture corrective.';
                END IF;
                RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
            END;
            $$;
        SQL);
        DB::statement('CREATE TRIGGER trg_transactions_immutables BEFORE UPDATE OR DELETE ON transactions FOR EACH ROW EXECUTE FUNCTION fn_proteger_transaction_validee()');
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS trg_transactions_immutables ON transactions');
        DB::statement('DROP FUNCTION IF EXISTS fn_proteger_transaction_validee()');
        DB::statement('ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_validees_completes_ck');
    }
};
