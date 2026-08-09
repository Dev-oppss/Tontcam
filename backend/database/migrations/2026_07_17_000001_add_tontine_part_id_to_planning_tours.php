<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// RG-TON : chaque part est indépendante et a son propre cycle de gain. Le planning
// des tours doit donc référencer la part exacte qui bénéficie du tour, pas seulement
// le membre — un membre avec 4 parts doit occuper 4 tours distincts, pas 1 seul.
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE planning_tours ADD COLUMN IF NOT EXISTS tontine_part_id UUID REFERENCES tontine_parts(id) ON DELETE SET NULL');
        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS idx_planning_tours_part_unique ON planning_tours(tontine_part_id) WHERE tontine_part_id IS NOT NULL');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS idx_planning_tours_part_unique');
        DB::statement('ALTER TABLE planning_tours DROP COLUMN IF EXISTS tontine_part_id');
    }
};
