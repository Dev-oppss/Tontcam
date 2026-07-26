<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // date_fin doit être nullable — une police d'assurance en cours n'a pas
        // forcément de date de fin connue. La validation API l'a toujours traitée
        // comme optionnelle ; seule la colonne SQL l'imposait, provoquant un 500
        // sur toute création d'assurance sans date de fin.
        DB::statement('ALTER TABLE tontine.assurances_membres ALTER COLUMN date_fin DROP NOT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE tontine.assurances_membres ALTER COLUMN date_fin SET NOT NULL');
    }
};
