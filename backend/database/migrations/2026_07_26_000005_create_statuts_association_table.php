<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE IF NOT EXISTS tontine.statuts_association (
                id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
                association_id  UUID        NOT NULL REFERENCES tontine.associations(id) ON DELETE CASCADE,
                version         VARCHAR(20) NOT NULL,
                fichier_url     TEXT        NOT NULL,
                date_adoption   DATE        NOT NULL,
                signataires     JSONB       DEFAULT '[]',
                uploaded_by     UUID        REFERENCES tontine.utilisateurs(id),
                est_actif       BOOLEAN     DEFAULT TRUE,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT statuts_version_asso_uq UNIQUE (association_id, version)
            )
        SQL);
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS tontine.statuts_association');
    }
};
