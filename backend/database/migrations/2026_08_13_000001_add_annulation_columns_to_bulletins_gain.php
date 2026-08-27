<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE bulletins_gain ADD COLUMN IF NOT EXISTS annule_par UUID REFERENCES utilisateurs(id)');
        DB::statement('ALTER TABLE bulletins_gain ADD COLUMN IF NOT EXISTS annule_at TIMESTAMPTZ');
        DB::statement('ALTER TABLE bulletins_gain ADD COLUMN IF NOT EXISTS motif_annulation VARCHAR(200)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE bulletins_gain DROP COLUMN IF EXISTS annule_par');
        DB::statement('ALTER TABLE bulletins_gain DROP COLUMN IF EXISTS annule_at');
        DB::statement('ALTER TABLE bulletins_gain DROP COLUMN IF EXISTS motif_annulation');
    }
};
