<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * RG-SEA-001 : les prêts (décaissement) et aides sociales (versement) doivent,
 * comme les cotisations, être rattachés à la réunion pendant laquelle l'argent
 * sort réellement de la caisse — traçabilité complète (voir SeanceTransaction).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE prets ADD COLUMN IF NOT EXISTS reunion_id UUID REFERENCES reunions(id)');
        DB::statement('ALTER TABLE evenements_sociaux ADD COLUMN IF NOT EXISTS reunion_id UUID REFERENCES reunions(id)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_prets_reunion ON prets(reunion_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_evenements_sociaux_reunion ON evenements_sociaux(reunion_id)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE prets DROP COLUMN IF EXISTS reunion_id');
        DB::statement('ALTER TABLE evenements_sociaux DROP COLUMN IF EXISTS reunion_id');
    }
};
