<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;
        DB::statement('ALTER TABLE encherites ADD COLUMN IF NOT EXISTS caisse_id UUID NULL REFERENCES caisses(id)');
        DB::statement('ALTER TABLE cycles_tontine ADD COLUMN IF NOT EXISTS caisse_enchere_id UUID NULL REFERENCES caisses(id)');
    }
    public function down(): void {}
};
