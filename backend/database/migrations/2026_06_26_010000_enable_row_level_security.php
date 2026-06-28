<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private array $manageRoles = ['super_admin', 'controleur', 'president', 'tresorier'];

    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::unprepared("create schema if not exists tontine");
        DB::unprepared(<<<'SQL'
create or replace function tontine.current_association_uuid()
returns uuid
language sql
stable
as $$
    select nullif(current_setting('tontine.current_association_id', true), '')::uuid
$$;
SQL);
        DB::unprepared(<<<'SQL'
create or replace function tontine.current_role_name()
returns text
language sql
stable
as $$
    select coalesce(nullif(current_setting('tontine.current_role', true), ''), '')
$$;
SQL);
        DB::unprepared(<<<'SQL'
create or replace function tontine.current_member_uuid()
returns uuid
language sql
stable
as $$
    select nullif(current_setting('tontine.current_membre_id', true), '')::uuid
$$;
SQL);

        foreach ($this->associationTables() as $table) {
            $this->applyAssociationPolicy($table);
        }

        foreach ($this->memberTables() as $table => $memberColumn) {
            $this->applyMemberPolicy($table, $memberColumn);
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach (array_merge($this->associationTables(), array_keys($this->memberTables())) as $table) {
            if (! $this->tableExists($table)) {
                continue;
            }
            DB::unprepared('drop policy if exists '.$this->policyName($table).' on '.$this->qualifiedTable($table));
            DB::unprepared('drop policy if exists '.$this->policyName($table.'_member').' on '.$this->qualifiedTable($table));
            DB::unprepared('alter table '.$this->qualifiedTable($table).' disable row level security');
        }

        DB::unprepared('drop function if exists tontine.current_member_uuid()');
        DB::unprepared('drop function if exists tontine.current_role_name()');
        DB::unprepared('drop function if exists tontine.current_association_uuid()');
    }

    private function associationTables(): array
    {
        return [
            'audit_log',
            'caisses',
            'cycles_tontine',
            'decision_ag',
            'echeances_pret',
            'historique_prets',
            'ordre_du_jour_items',
            'ordre_du_jour_rubriques',
            'parametres_association',
            'rapprochements_bancaires',
            'reglement_interieur',
            'reunions',
            'tontines',
            'transactions',
            'transferts_caisse',
            'types_aide_sociale',
            'types_sanction',
            'postes',
        ];
    }

    private function memberTables(): array
    {
        return [
            'assurances_membres' => 'membre_id',
            'bulletins_gain' => 'gagnant_membre_id',
            'cotisations_tontine' => 'membre_id',
            'evenements_sociaux' => 'membre_id',
            'membre_postes' => 'membre_id',
            'membres' => 'id',
            'notifications' => 'membre_id',
            'presences' => 'membre_id',
            'prets' => 'emprunteur_id',
            'reunion_signataires' => 'membre_id',
            'sanctions_membres' => 'membre_id',
            'tontine_parts' => 'membre_id',
            'utilisateurs' => 'membre_id',
        ];
    }

    private function applyAssociationPolicy(string $table): void
    {
        $qualified = $this->qualifiedTable($table);
        if (! $this->tableExists($table) || ! $this->columnExists($table, 'association_id')) {
            return;
        }

        $policy = $this->policyName($table);
        $condition = "(tontine.current_role_name() in ('" . implode("','", $this->manageRoles) . "') or association_id = tontine.current_association_uuid())";

        DB::unprepared('alter table '.$qualified.' enable row level security');
        DB::unprepared('alter table '.$qualified.' force row level security');
        DB::unprepared('drop policy if exists '.$policy.' on '.$qualified);
        DB::unprepared('create policy '.$policy.' on '.$qualified.' for all using ('.$condition.') with check ('.$condition.')');
    }

    private function applyMemberPolicy(string $table, string $memberColumn): void
    {
        $qualified = $this->qualifiedTable($table);
        if (! $this->tableExists($table) || ! $this->columnExists($table, 'association_id')) {
            return;
        }

        if (! $this->columnExists($table, $memberColumn)) {
            $this->applyAssociationPolicy($table);
            return;
        }

        $policy = $this->policyName($table.'_member');
        $manage = "tontine.current_role_name() in ('".implode("','", $this->manageRoles)."')";
        $condition = "({$manage} or (association_id = tontine.current_association_uuid() and {$memberColumn} = tontine.current_member_uuid()))";

        DB::unprepared('alter table '.$qualified.' enable row level security');
        DB::unprepared('alter table '.$qualified.' force row level security');
        DB::unprepared('drop policy if exists '.$policy.' on '.$qualified);
        DB::unprepared('create policy '.$policy.' on '.$qualified.' for all using ('.$condition.') with check ('.$condition.')');
    }

    private function qualifiedTable(string $table): string
    {
        return 'tontine.'.$table;
    }

    private function policyName(string $table): string
    {
        return 'rls_'.$table;
    }

    private function tableExists(string $table): bool
    {
        $row = DB::selectOne(
            'select exists(select 1 from information_schema.tables where table_schema = ? and table_name = ?) as exists',
            ['tontine', $table]
        );

        return (bool) ($row->exists ?? false);
    }

    private function columnExists(string $table, string $column): bool
    {
        $row = DB::selectOne(
            'select exists(select 1 from information_schema.columns where table_schema = ? and table_name = ? and column_name = ?) as exists',
            ['tontine', $table, $column]
        );

        return (bool) ($row->exists ?? false);
    }
};
