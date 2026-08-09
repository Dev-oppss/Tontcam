<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Association;
use App\Services\AccessScopeService;
use App\Services\ParametreService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ParametreController extends Controller
{
    public function __construct(private AccessScopeService $scope, private ParametreService $service) {}

    public function index(): JsonResponse
    {
        $association = $this->scope->scopeAssociation(Association::query())->firstOrFail();

        return response()->json([
            'coeur' => $association->only([
                'devise', 'seuil_approbation_pret', 'nb_signataires_pv',
                'delai_rappel_j7', 'delai_rappel_j3', 'delai_rappel_j1',
            ]),
            'etendus' => $this->service->tous($association->id),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $association = $this->scope->scopeAssociation(Association::query())->firstOrFail();
        $this->authorize('update', $association);

        $data = $request->validate([
            'devise' => ['sometimes', 'string', 'size:3'],
            'seuil_approbation_pret' => ['sometimes', 'numeric', 'min:0'],
            'nb_signataires_pv' => ['sometimes', 'integer', 'between:2,7'],
            'delai_rappel_j7' => ['sometimes', 'boolean'],
            'delai_rappel_j3' => ['sometimes', 'boolean'],
            'delai_rappel_j1' => ['sometimes', 'boolean'],
            'etendus' => ['sometimes', 'array'],
        ]);

        if (array_key_exists('devise', $data) && $data['devise'] !== $association->devise) {
            $existeTransaction = \App\Models\Transaction::whereHas(
                'caisse', fn ($query) => $query->where('association_id', $association->id)
            )->exists();
            if ($existeTransaction) {
                return response()->json(['message' => 'La devise ne peut plus être modifiée : des transactions existent déjà.'], 422);
            }
        }

        $this->service->definirCoeur($association, $data);

        foreach ($data['etendus'] ?? [] as $cle => $valeur) {
            $this->service->definir($association->id, $cle, $valeur, $request->user());
        }

        return response()->json([
            'coeur' => $association->fresh()->only(['devise', 'seuil_approbation_pret', 'nb_signataires_pv', 'delai_rappel_j7', 'delai_rappel_j3', 'delai_rappel_j1']),
            'etendus' => $this->service->tous($association->id),
        ]);
    }
}
