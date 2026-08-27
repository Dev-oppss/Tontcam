<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Horodatage du dernier rendu PDF effectivement écrit sur disque. Comparé à
        // updated_at dans BulletinGainService::genererPdf() pour éviter de régénérer
        // le PDF (rendu DomPDF coûteux) à chaque clic sur « Bulletin » quand le
        // bulletin n'a pas changé depuis le dernier rendu.
        DB::statement('ALTER TABLE bulletins_gain ADD COLUMN IF NOT EXISTS pdf_genere_at TIMESTAMPTZ');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE bulletins_gain DROP COLUMN IF EXISTS pdf_genere_at');
    }
};
