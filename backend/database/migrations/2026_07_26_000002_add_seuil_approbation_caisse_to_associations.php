<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE tontine.associations ADD COLUMN IF NOT EXISTS seuil_approbation_caisse NUMERIC(15,2) DEFAULT 500000');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE tontine.associations DROP COLUMN IF EXISTS seuil_approbation_caisse');
    }
};
