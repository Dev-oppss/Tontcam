<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * L'ouverture de séance (bouton "Ouvrir la séance") demandait déjà heure
 * d'ouverture / président / secrétaire / mot d'ouverture côté frontend, mais
 * ces informations n'étaient jamais envoyées ni stockées : seul le statut
 * passait à 'ouverte'. On ajoute les colonnes pour les persister réellement.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE reunions ADD COLUMN IF NOT EXISTS heure_ouverture_reelle TIME");
        DB::statement("ALTER TABLE reunions ADD COLUMN IF NOT EXISTS president_seance VARCHAR(255)");
        DB::statement("ALTER TABLE reunions ADD COLUMN IF NOT EXISTS secretaire_seance VARCHAR(255)");
        DB::statement("ALTER TABLE reunions ADD COLUMN IF NOT EXISTS mot_ouverture TEXT");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE reunions DROP COLUMN IF EXISTS heure_ouverture_reelle');
        DB::statement('ALTER TABLE reunions DROP COLUMN IF EXISTS president_seance');
        DB::statement('ALTER TABLE reunions DROP COLUMN IF EXISTS secretaire_seance');
        DB::statement('ALTER TABLE reunions DROP COLUMN IF EXISTS mot_ouverture');
    }
};
