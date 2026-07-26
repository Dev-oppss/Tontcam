<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS associations_nom_uq ON tontine.associations (nom)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS tontine.associations_nom_uq');
    }
};
