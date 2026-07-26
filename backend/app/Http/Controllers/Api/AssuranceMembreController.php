<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AssuranceMembre;
use App\Models\Membre;
use App\Services\AccessScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssuranceMembreController extends Controller
{
    public function __construct(private AccessScopeService $scope) {}

    public function index(string $membreId): JsonResponse
    {
        $membre = Membre::where('association_id', $this->scope->associationId())->findOrFail($membreId);
        $this->authorize('view', $membre);

        return response()->json($membre->assurances()->get());
    }

    public function store(Request $request, string $membreId): JsonResponse
    {
        $membre = Membre::where('association_id', $this->scope->associationId())->findOrFail($membreId);
        // Gérer l'assurance d'un membre est une action administrative sur son dossier :
        // on réutilise la même autorisation que la modification du membre lui-même.
        // Sans ce contrôle, N'IMPORTE QUEL rôle (y compris un simple membre) pouvait créer
        // une assurance pour n'importe quel autre membre de l'association.
        $this->authorize('update', $membre);

        $data = $request->validate([
            'type_assurance' => ['required', 'in:mutuelle,sante,vie,autre'],
            'assureur' => ['nullable', 'string', 'max:150'],
            'numero_police' => ['nullable', 'string', 'max:100'],
            'date_debut' => ['required', 'date'],
            'date_fin' => ['nullable', 'date', 'after:date_debut'],
            'prime_mensuelle' => ['nullable', 'numeric', 'min:0'],
            'caisse_id' => ['nullable', 'uuid'],
        ]);
        $data['membre_id'] = $membre->id;
        $data['actif'] = true;

        $assurance = AssuranceMembre::create($data);

        return response()->json($assurance, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $assurance = AssuranceMembre::whereHas('membre', fn ($q) => $q->where('association_id', $this->scope->associationId()))->findOrFail($id);
        $this->authorize('update', $assurance->membre);

        $assurance->update($request->validate([
            'prime_mensuelle' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'date_fin' => ['sometimes', 'nullable', 'date'],
            'actif' => ['sometimes', 'boolean'],
        ]));

        return response()->json($assurance);
    }
}
