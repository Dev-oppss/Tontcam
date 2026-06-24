<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $sqlPath = base_path('../database/script.sql');

        if (! file_exists($sqlPath)) {
            throw new RuntimeException('Fichier source SQL introuvable: '.$sqlPath);
        }

        DB::unprepared(file_get_contents($sqlPath));
    }

    public function down(): void
    {
        DB::statement('DROP SCHEMA IF EXISTS tontine CASCADE');
    }
};
