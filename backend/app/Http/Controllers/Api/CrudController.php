<?php

namespace App\Http\Controllers\Api;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;

abstract class CrudController extends Controller
{
    protected string $model;

    /**
     * Champs autorisés à être filtrés via query-string.
     * À surcharger dans chaque contrôleur fils si nécessaire.
     */
    protected array $filterable = [];

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', $this->model);
        return response()->json($this->query($request)->paginate($request->integer('per_page', 25)));
    }

    /**
     * Création — utilise uniquement les champs déclarés dans $fillable du modèle
     * pour éviter la mass-assignment non contrôlée.
     */
    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', $this->model);
        $item = $this->model::create($request->all());
        return response()->json($item, 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $item = $this->query($request)->findOrFail($id);
        Gate::authorize('view', $item);
        return response()->json($item);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $item = $this->query($request)->findOrFail($id);
        Gate::authorize('update', $item);
        $item->fill($request->all())->save();
        return response()->json($item);
    }

    /**
     * RG-MBR-006 : Un membre ne peut pas être supprimé s'il a des transactions.
     * Cette règle est appliquée au niveau du modèle (SoftDeletes + contraintes FK).
     * Ici on retourne 409 si une contrainte DB empêche la suppression.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        try {
            $item = $this->query($request)->findOrFail($id);
            Gate::authorize('delete', $item);
            $item->delete();
        } catch (\Illuminate\Database\QueryException $e) {
            // Contrainte FK violée (données liées existantes)
            return response()->json([
                'message' => 'Impossible de supprimer : des données liées existent.',
            ], 409);
        }

        return response()->json(['deleted' => true]);
    }

    /**
     * Construit la query de base.
     * Les sous-classes peuvent surcharger pour ajouter des scopes métier
     * (ex: isolation par association_id — RG-ORG-015 / RG-SEC-008).
     */
    protected function query(Request $request)
    {
        /** @var Model $model */
        $model = new $this->model;
        $query = $model->newQuery();

        $userAssociationId = $request->user()?->membre?->association_id
            ?? $request->user()?->association_id;

        if (
            $userAssociationId
            && ($request->user()?->role ?? null) !== 'super_admin'
            && Schema::hasColumn($this->baseTableName($model), 'association_id')
        ) {
            $query->where('association_id', $userAssociationId);
        }

        // Filtrage générique sur les champs déclarés dans $filterable
        foreach ($this->filterable as $field) {
            if ($request->has($field)) {
                $query->where($field, $request->input($field));
            }
        }

        return $query;
    }

    private function baseTableName(Model $model): string
    {
        $table = $model->getTable();
        return str_contains($table, '.') ? substr($table, strrpos($table, '.') + 1) : $table;
    }
}
