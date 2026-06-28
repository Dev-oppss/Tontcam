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

        $this->dropExistingTypes();

        $sql = file_get_contents($sqlPath);
        $sql = $this->sanitizeSqlScript($sql);
        DB::unprepared($sql);
    }

    public function down(): void
    {
        DB::statement('DROP SCHEMA IF EXISTS tontine CASCADE');
    }

    private function sanitizeSqlScript(string $sql): string
    {
        $sql = preg_replace(
            "/est_actif\\s+BOOLEAN\\s+GENERATED\\s+ALWAYS\\s+AS\\s*\\(date_fin\\s+IS\\s+NULL\\s+OR\\s+date_fin\\s+>=\\s+CURRENT_DATE\\)\\s+STORED/i",
            "est_actif BOOLEAN DEFAULT TRUE",
            $sql
        ) ?? $sql;
        $sql = str_replace("CREATE EXTENSION IF NOT EXISTS \"unaccent\";", '', $sql);
        $sql = str_replace('to_tsvector(\'french\', unaccent(nom || \' \' || prenom))', 'to_tsvector(\'french\', lower(nom || \' \' || prenom))', $sql);
        $sql = str_replace('SELECT p.id, ca.association_id,', 'SELECT p.id, cai.association_id,', $sql);
        $sql = str_replace('GROUP BY p.id, ca.association_id,', 'GROUP BY p.id, cai.association_id,', $sql);

        $lines = preg_split('/\R/', $sql) ?: [];
        $started = false;
        $kept = [];

        foreach ($lines as $line) {
            $trimmed = ltrim($line);
            if (! $started) {
                if (preg_match('/^(--|CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SET|SELECT|WITH|DO)\b/i', $trimmed)) {
                    $started = true;
                } else {
                    continue;
                }
            }

            if (preg_match('/^Récapitulatif/i', $trimmed)) {
                continue;
            }

            $kept[] = $line;
        }

        return implode(PHP_EOL, $kept);
    }

    private function dropExistingTypes(): void
    {
        $types = [
            'statut_membre',
            'statut_reunion',
            'type_reunion',
            'statut_presence',
            'mode_attribution',
            'statut_tontine',
            'statut_part',
            'statut_cycle',
            'statut_cotisation',
            'statut_bulletin',
            'type_caisse',
            'type_transaction',
            'mode_paiement',
            'statut_pret',
            'statut_echeance',
            'mode_calcul_sanction',
            'statut_sanction',
            'type_evenement_social',
            'statut_aide',
            'statut_decision_ag',
            'type_decision_ag',
            'role_utilisateur',
            'canal_notification',
            'statut_notification',
            'type_retenue_bulletin',
            'methode_amortissement',
            'option_surplus_enchere',
        ];

        foreach ($types as $type) {
            DB::statement("drop type if exists tontine.$type cascade");
        }
    }
};
