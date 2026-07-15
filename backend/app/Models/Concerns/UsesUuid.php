<?php

namespace App\Models\Concerns;

use Illuminate\Support\Str;

trait UsesUuid
{
    /**
     * Laravel appelle automatiquement cette méthode (convention initialize+NomDuTrait)
     * au constructeur du modèle. On DOIT passer par une méthode plutôt que par une
     * redéclaration de propriété : PHP interdit qu'un trait redéclare une propriété
     * avec une valeur par défaut différente de celle héritée de la classe parente
     * (ici Model::$incrementing = true) — fatal error au chargement sinon.
     */
    public function initializeUsesUuid(): void
    {
        $this->incrementing = false;
        $this->keyType = 'string';
        $this->guarded = [];
    }

    /**
     * Génère l'UUID côté PHP avant l'insertion. Indispensable : comme incrementing=false,
     * Eloquent ne relit JAMAIS la valeur générée par le DEFAULT uuid_generate_v4() de
     * Postgres après un INSERT — sans ce hook, chaque create() renvoie un modèle sans id.
     */
    protected static function bootUsesUuid(): void
    {
        static::creating(function ($model) {
            $key = $model->getKeyName();
            if (empty($model->{$key})) {
                $model->{$key} = (string) Str::uuid();
            }
        });
    }

    public function getTable()
    {
        $table = parent::getTable();
        return str_contains($table, '.') ? $table : 'tontine.'.$table;
    }
}
