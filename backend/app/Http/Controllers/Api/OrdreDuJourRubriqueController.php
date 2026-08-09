<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrdreDuJourRubrique;
use App\Services\AccessScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Catalogue des rubriques d'ordre du jour utilisées à chaque nouvelle réunion
 * (ReunionService::planifier() s'en sert pour pré-remplir l'ordre du jour).
 */
class OrdreDuJourRubriqueController extends Controller
{
    public function __construct(private AccessScopeService $scope) {}

    public function index(): JsonResponse
    {
        return response()->json(
            $this->scope->scopeAssociation(OrdreDuJourRubrique::query())->orderBy('ordre_defaut')->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'libelle' => ['required', 'string', 'max:150'],
            'ordre_defaut' => ['required', 'integer', 'min:0'],
            'est_obligatoire' => ['sometimes', 'boolean'],
        ]);
        $data['association_id'] = $this->scope->associationId();
        $data['est_systeme'] = false;
        $data['actif'] = true;

        $rubrique = OrdreDuJourRubrique::create($data);

        return response()->json($rubrique, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $rubrique = $this->scope->scopeAssociation(OrdreDuJourRubrique::query())->findOrFail($id);

        if ($rubrique->est_systeme && $request->has('actif') && ! $request->boolean('actif')) {
            return response()->json(['message' => 'Une rubrique système ne peut pas être désactivée.'], 422);
        }

        $rubrique->update($request->validate([
            'libelle' => ['sometimes', 'string', 'max:150'],
            'ordre_defaut' => ['sometimes', 'integer', 'min:0'],
            'est_obligatoire' => ['sometimes', 'boolean'],
            'actif' => ['sometimes', 'boolean'],
        ]));

        return response()->json($rubrique);
    }

    public function destroy(string $id): JsonResponse
    {
        $rubrique = $this->scope->scopeAssociation(OrdreDuJourRubrique::query())->findOrFail($id);
        if ($rubrique->est_systeme) {
            return response()->json(['message' => 'Une rubrique système ne peut pas être supprimée.'], 422);
        }
        $rubrique->delete();

        return response()->json(['deleted' => true]);
    }
}
