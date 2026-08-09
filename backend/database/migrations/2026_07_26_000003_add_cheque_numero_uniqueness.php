<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // RG-CAI-012 : un même numéro de chèque ne doit pas pouvoir être saisi deux
        // fois sur la même caisse. Index partiel (ignore les lignes sans chèque).
        DB::statement(
            'CREATE UNIQUE INDEX IF NOT EXISTS transactions_cheque_numero_uq
             ON tontine.transactions (caisse_id, cheque_numero)
             WHERE cheque_numero IS NOT NULL'
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS tontine.transactions_cheque_numero_uq');
    }
};
