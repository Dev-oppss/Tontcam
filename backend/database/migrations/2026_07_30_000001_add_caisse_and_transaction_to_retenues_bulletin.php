<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE retenues_bulletin ADD COLUMN IF NOT EXISTS caisse_id UUID NULL REFERENCES caisses(id)');
        DB::statement('ALTER TABLE retenues_bulletin ADD COLUMN IF NOT EXISTS transaction_id UUID NULL REFERENCES transactions(id)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_retenues_caisse ON retenues_bulletin(caisse_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_retenues_transaction ON retenues_bulletin(transaction_id)');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE retenues_bulletin DROP COLUMN IF EXISTS transaction_id');
        DB::statement('ALTER TABLE retenues_bulletin DROP COLUMN IF EXISTS caisse_id');
    }
};
