<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TypeSanction;
use App\Services\AccessScopeService;
use App\Services\PermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TypeSanctionController extends Controller
{
    public function __construct(private AccessScopeService $scope, private PermissionService $permissions) {}

    public function index(): JsonResponse
    {
        return response()->json($this->scope->scopeAssociation(TypeSanction::query())->orderBy('libelle')->get());
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->permissions->peut($request->user(), 'sanctions', 'create')) {
            return response()->json(['message' => 'Action non autorisée.'], 403);
        }
        $data = $request->validate([
            'libelle' => ['required', 'string', 'max:150'],
            'mode_calcul' => ['required', 'in:fixe,pourcentage,journalier'],
            'montant_fixe' => ['required_if:mode_calcul,fixe', 'nullable', 'numeric', 'min:0'],
            'montant_pct' => ['required_if:mode_calcul,pourcentage', 'nullable', 'numeric', 'min:0'],
            'montant_journalier' => ['required_if:mode_calcul,journalier', 'nullable', 'numeric', 'min:0'],
            'declencheur' => ['nullable', 'in:absence_non_excusee,retard_cotisation,retard_pret'],
            'est_automatique' => ['sometimes', 'boolean'],
            'description' => ['nullable', 'string'],
        ]);
        $data['association_id'] = $this->scope->associationId();
        $data['actif'] = true;

        $type = TypeSanction::create($data);

        return response()->json($type, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $type = $this->scope->scopeAssociation(TypeSanction::query())->findOrFail($id);

        $type->update($request->validate([
            'libelle' => ['sometimes', 'string', 'max:150'],
            'montant_fixe' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'montant_pct' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'montant_journalier' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'actif' => ['sometimes', 'boolean'],
        ]));

        return response()->json($type);
    }

    public function destroy(string $id): JsonResponse
    {
        $type = $this->scope->scopeAssociation(TypeSanction::query())->findOrFail($id);
        if ($type->sanctions()->exists()) {
            return response()->json(['message' => 'Suppression impossible : ce type a déjà été appliqué. Désactivez-le plutôt.'], 422);
        }
        $type->delete();

        return response()->json(['deleted' => true]);
    }
}
