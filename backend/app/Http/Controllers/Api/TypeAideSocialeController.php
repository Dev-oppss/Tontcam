<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TypeAideSociale;
use App\Services\AccessScopeService;
use App\Services\PermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TypeAideSocialeController extends Controller
{
    public function __construct(private AccessScopeService $scope, private PermissionService $permissions) {}

    public function index(): JsonResponse
    {
        return response()->json($this->scope->scopeAssociation(TypeAideSociale::query())->orderBy('libelle')->get());
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->permissions->peut($request->user(), 'social', 'update')) {
            return response()->json(['message' => 'Action non autorisée.'], 403);
        }

        $data = $request->validate([
            'libelle' => ['required', 'string', 'max:150'],
            'type_evenement' => ['required', 'in:naissance,mariage,maladie,deces_membre,deces_famille,autre'],
            'montant_fixe' => ['nullable', 'numeric', 'min:0'],
            'montant_min' => ['nullable', 'numeric', 'min:0'],
            'montant_max' => ['nullable', 'numeric', 'min:0'],
            'delai_versement_jours' => ['nullable', 'integer', 'min:1'],
            'caisse_source_id' => ['required', 'uuid'],
            'nb_max_par_an' => ['sometimes', 'integer', 'min:1'],
            'justificatif_requis' => ['sometimes', 'boolean'],
        ]);
        $data['association_id'] = $this->scope->associationId();
        $data['actif'] = true;
        $data['date_effet'] = now()->toDateString();

        $type = TypeAideSociale::create($data);

        return response()->json($type, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $type = $this->scope->scopeAssociation(TypeAideSociale::query())->findOrFail($id);
        if (! $this->permissions->peut($request->user(), 'social', 'update')) {
            return response()->json(['message' => 'Action non autorisée.'], 403);
        }

        $type->update($request->validate([
            'libelle' => ['sometimes', 'string', 'max:150'],
            'montant_fixe' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'montant_min' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'montant_max' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'nb_max_par_an' => ['sometimes', 'integer', 'min:1'],
            'actif' => ['sometimes', 'boolean'],
        ]));

        return response()->json($type);
    }
}
