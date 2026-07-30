<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;

        DB::statement('ALTER TABLE tontines ADD COLUMN IF NOT EXISTS max_cycles_par_reunion SMALLINT NOT NULL DEFAULT 1 CHECK (max_cycles_par_reunion > 0)');
        DB::statement('ALTER TABLE cycles_tontine DROP CONSTRAINT IF EXISTS cycles_tontine_reunion_uq');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_cycles_tontine_reunion ON cycles_tontine(tontine_id, reunion_id)');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;

        DB::statement('ALTER TABLE cycles_tontine ADD CONSTRAINT cycles_tontine_reunion_uq UNIQUE (tontine_id, reunion_id)');
        DB::statement('ALTER TABLE tontines DROP COLUMN IF EXISTS max_cycles_par_reunion');
    }
};
