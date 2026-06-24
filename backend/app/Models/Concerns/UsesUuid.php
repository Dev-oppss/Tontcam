<?php

namespace App\Models\Concerns;

trait UsesUuid
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];

    public function getTable()
    {
        $table = parent::getTable();
        return str_contains($table, '.') ? $table : 'tontine.'.$table;
    }
}
