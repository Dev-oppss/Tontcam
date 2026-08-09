<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('postes', function (Blueprint $table) {
            $table->string('role_utilisateur', 30)->nullable()->after('code');
        });

        DB::table('postes')->whereNull('role_utilisateur')->update([
            'role_utilisateur' => DB::raw("CASE code
                WHEN 'PRESIDENT' THEN 'president'
                WHEN 'SECRETAIRE_GENERAL' THEN 'secretaire'
                WHEN 'TRESORIER_GENERAL' THEN 'tresorier'
                ELSE NULL END"),
        ]);
    }

    public function down(): void
    {
        Schema::table('postes', function (Blueprint $table) {
            $table->dropColumn('role_utilisateur');
        });
    }
};
